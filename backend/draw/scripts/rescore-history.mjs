import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,isAbsolute,join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {build} from 'esbuild';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,ScanCommand,GetCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
const [mode,dir]=process.argv.slice(2);
if(!['evaluate','apply'].includes(mode)||!dir||!isAbsolute(dir))throw Error('Usage: rescore-history.mjs evaluate|apply <absolute backup directory>');
mkdirSync(dir,{recursive:true,mode:0o700});
process.env.AWS_PROFILE='codex-prod';process.env.AWS_REGION='ap-northeast-1';
const root=resolve(import.meta.dirname,'..');
const config=JSON.parse(execFileSync('aws',['lambda','get-function-configuration','--profile','codex-prod','--region','ap-northeast-1','--function-name','draw-submit-prod'],{encoding:'utf8'}));
process.env.OPENAI_API_KEY_SECRET_ID=config.Environment.Variables.OPENAI_API_KEY_SECRET_ID;
const table=config.Environment.Variables.DRAW_TABLE,bucket=config.Environment.Variables.DRAW_BUCKET;
if(!table||!bucket)throw Error('Missing production table/bucket');
for(const name of ['DRAW_TABLE','DRAW_BUCKET','RATE_LIMIT_TABLE','CLOUDFRONT_DOMAIN','CF_KEY_PAIR_ID','CF_PRIVATE_KEY_SECRET_ID'])process.env[name]=config.Environment.Variables[name];
const bundled=join(dir,'scoring.cjs');
await build({stdin:{contents:`export {scoreWithDecisions,decisionsVersions,decisionsInstructionHash} from './src/lib/decisions.ts';export {computeGameScore,toCompatibilityBreakdown} from './src/lib/gameScore.ts';export {asPng} from './src/lib/image.ts';export {computeInkRatio,isInkGateFail} from './src/lib/inkGate.ts';export {resolveDrawPrompt,getCurrentMonthJst} from './src/lib/prompt.ts';`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',target:'node20',format:'cjs',loader:{'.md':'text','.wasm':'binary'},outfile:bundled,logLevel:'silent'});
const api=createRequire(import.meta.url)(bundled);
const ddb=DynamoDBDocumentClient.from(new DynamoDBClient({region:process.env.AWS_REGION}));
const s3=new S3Client({region:process.env.AWS_REGION,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
const save=(name,data)=>writeFileSync(join(dir,name),JSON.stringify(data,null,2),{mode:0o600});
const load=name=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const key=r=>({promptId:r.promptId,submissionId:r.submissionId});
const id=r=>r.promptId+'/'+r.submissionId;
const sort=(score,r)=>`${String(100-score).padStart(3,'0')}#${r.createdAt}#${r.submissionId}`;
let snapshot;
if(existsSync(join(dir,'snapshot.json')))snapshot=load('snapshot.json');
else {
 if(mode!=='evaluate')throw Error('No snapshot');
 const records=[];let ExclusiveStartKey;
 do{const r=await ddb.send(new ScanCommand({TableName:table,ConsistentRead:true,ExclusiveStartKey}));records.push(...r.Items);ExclusiveStartKey=r.LastEvaluatedKey;}while(ExclusiveStartKey);
 const cutoff='prompt-'+api.getCurrentMonthJst();
 const targets=records.filter(r=>/^prompt-\d{4}-\d{2}$/.test(r.promptId)&&r.promptId<cutoff).sort((a,b)=>id(a).localeCompare(id(b)));
 if(!targets.length)throw Error('No historical records');
 for(const r of targets)if(r.rankingEligible===false||r.rankingStatus!=='final_top20'||r.GSI1PK!==r.promptId||!r.scoreSortKey||!r.imageKey)throw Error('Unsupported archived record '+id(r));
 for(const month of new Set(targets.map(r=>r.promptId)))if(targets.filter(r=>r.promptId===month).length>20)throw Error('More than 20 archived records');
 snapshot={createdAt:new Date().toISOString(),table,bucket,cutoff,instructionHash:api.decisionsInstructionHash,records:targets};save('snapshot.json',snapshot);
}
if(snapshot.table!==table||snapshot.bucket!==bucket||snapshot.instructionHash!==api.decisionsInstructionHash||snapshot.cutoff!=='prompt-'+api.getCurrentMonthJst())throw Error('Snapshot context changed');
const results=existsSync(join(dir,'results.json'))?load('results.json'):{};
if(mode==='evaluate'){
 mkdirSync(join(dir,'images'),{recursive:true,mode:0o700});
 for(const r of snapshot.records){
  if(results[id(r)])continue;
  const image=join(dir,'images',r.submissionId+'.'+r.imageKey.split('.').at(-1));
  if(!existsSync(image)){const obj=await s3.send(new GetObjectCommand({Bucket:bucket,Key:r.imageKey}));writeFileSync(image,Buffer.from(await obj.Body.transformToByteArray()),{mode:0o600});}
  const original=readFileSync(image),bytes=await api.asPng(original),inkRatio=api.computeInkRatio(bytes),gated=api.isInkGateFail(inkRatio);const start=Date.now();
  const measured=gated?null:await api.scoreWithDecisions(api.resolveDrawPrompt({promptId:r.promptId}).promptText,bytes);
  results[id(r)]={imageSha256:createHash('sha256').update(original).digest('hex'),inkRatio,gated,measured,points:measured?api.computeGameScore(measured.ratings):{score:0,baseScore:0,gameScore:0},latencyMs:Date.now()-start,recordedAt:new Date().toISOString()};save('results.json',results);
  console.log(`${Object.keys(results).length}/${snapshot.records.length} ${id(r)} ${r.score} -> ${results[id(r)].points.score}`);
 }
}
if(snapshot.records.some(r=>!results[id(r)]))throw Error('Incomplete evaluations');
const plan=snapshot.records.map(r=>{
 const x=results[id(r)],m=x.measured;
 return {...key(r),oldScore:r.score,fields:{score:x.points.score,baseScore:m?x.points.baseScore:null,gameScore:m?x.points.gameScore:null,breakdown:m?api.toCompatibilityBreakdown(m.ratings):{likeness:0,composition:0,originality:0},primaryProvider:m?'openai-decisions':null,primaryModelId:m?.modelId??null,primaryRubric:m?.ratings??null,primaryAxisEvidence:null,primaryMeanLevels:m?.means??null,primaryProbabilities:m?.probabilities??null,primaryConfidence:m?.confidence??null,primaryRequestId:m?.requestId??null,primaryInstructionHash:m?api.decisionsInstructionHash:null,primaryInputTokens:m?.usage.inputTokens??null,primaryCachedInputTokens:m?.usage.cachedInputTokens??null,primaryCacheWriteTokens:m?.usage.cacheWriteTokens??null,primaryOutputTokens:m?.usage.outputTokens??null,primaryTotalTokens:m?.usage.totalTokens??null,primaryEstimatedCostUsd:m?.estimatedCostUsd??null,primaryLatencyMs:m?x.latencyMs:null,promptVersion:m?api.decisionsVersions.promptVersion:null,rubricVersion:m?api.decisionsVersions.rubricVersion:null,scoringVersion:m?api.decisionsVersions.scoringVersion:null,aiFallbackUsed:x.gated,tokenRecordedAt:x.recordedAt,scoreSortKey:sort(x.points.score,r)}};
});
for(const month of new Set(plan.map(r=>r.promptId))){const sorted=plan.filter(r=>r.promptId===month).sort((a,b)=>a.fields.scoreSortKey.localeCompare(b.fields.scoreSortKey));sorted.forEach((r,i)=>r.fields.rank=i+1);}
save('plan.json',plan);
const summary={count:plan.length,costUsd:Object.values(results).reduce((s,r)=>s+(r.measured?.estimatedCostUsd||0),0),gated:Object.values(results).filter(r=>r.gated).length,oldMean:plan.reduce((s,r)=>s+r.oldScore,0)/plan.length,newMean:plan.reduce((s,r)=>s+r.fields.score,0)/plan.length,lower:plan.filter(r=>r.fields.score<r.oldScore).length,equal:plan.filter(r=>r.fields.score===r.oldScore).length,higher:plan.filter(r=>r.fields.score>r.oldScore).length};save('summary.json',summary);console.log(JSON.stringify(summary));
if(mode==='apply'){
 const actual=async r=>(await ddb.send(new GetCommand({TableName:table,Key:key(r),ConsistentRead:true}))).Item;
 const expected=(r,p)=>({...r,...p.fields});
 // Fail before any write if records have changed outside this migration.
 for(const r of snapshot.records){const p=plan.find(p=>id(p)===id(r)),a=await actual(r);if(!isDeepStrictEqual(a,r)&&!isDeepStrictEqual(a,expected(r,p)))throw Error('Concurrent change '+id(r));}
 for(const month of new Set(plan.map(r=>r.promptId))){
  const group=plan.filter(p=>p.promptId===month);const states=await Promise.all(group.map(async p=>{const r=snapshot.records.find(r=>id(r)===id(p));return isDeepStrictEqual(await actual(r),expected(r,p));}));
  if(states.every(Boolean)){console.log('Already applied '+month);continue;}if(states.some(Boolean))throw Error('Partial month '+month);
  await ddb.send(new TransactWriteCommand({TransactItems:group.map(p=>{
   const r=snapshot.records.find(r=>id(r)===id(p));const names={'#old':'score','#image':'imageKey'},values={':old':r.score,':image':r.imageKey};const terms=Object.entries(p.fields).map(([k,v],i)=>{names['#f'+i]=k;values[':v'+i]=v;return '#f'+i+' = :v'+i;});
   return {Update:{TableName:table,Key:key(r),UpdateExpression:'SET '+terms.join(', '),ConditionExpression:'#old = :old AND #image = :image',ExpressionAttributeNames:names,ExpressionAttributeValues:values}};
  })}));console.log('Applied '+month);
 }
 for(const r of snapshot.records){const p=plan.find(p=>id(p)===id(r));if(!isDeepStrictEqual(await actual(r),expected(r,p)))throw Error('Verification failed '+id(r));}
 const base='https://2vzy10yq0e.execute-api.ap-northeast-1.amazonaws.com';
 for(const month of new Set(plan.map(r=>r.promptId))){const expectedRows=plan.filter(r=>r.promptId===month).sort((a,b)=>a.fields.rank-b.fields.rank).map(r=>({submissionId:r.submissionId,score:r.fields.score,rank:r.fields.rank}));let verified=false;
  for(let attempt=0;attempt<10;attempt++){const resp=await fetch(base+'/api/draw/leaderboard?promptId='+month);if(!resp.ok)throw Error('Leaderboard HTTP '+resp.status);const body=await resp.json();if(isDeepStrictEqual(body.items.map(r=>({submissionId:r.submissionId,score:r.score,rank:r.rank})),expectedRows)){verified=true;break;}await new Promise(r=>setTimeout(r,1000));}
  if(!verified)throw Error('Public leaderboard mismatch '+month);
 }
 save('verification.json',{verifiedAt:new Date().toISOString(),count:plan.length,allOtherFieldsPreserved:true,publicLeaderboardsVerified:true});console.log('All records and public monthly leaderboards verified; reviews preserved.');
}
