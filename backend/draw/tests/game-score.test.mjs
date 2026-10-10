import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';
import {candidateScore,candidates} from '../../../tools/draw-evaluation/score-candidates.mjs';
const dir=await mkdtemp(join(tmpdir(),'draw-adopted-test-'));
const root=resolve(import.meta.dirname,'..');
async function bundle(entry,name,plugins=[]){const outfile=join(dir,name+'.mjs');await build({entryPoints:[resolve(root,entry)],bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.md':'text','.wasm':'binary'},outfile,plugins});return import(pathToFileURL(outfile).href);}
// Pure scorer needs no env, keys, SDK clients or inference.
const scoring=await bundle('src/lib/gameScore.ts','score');
const frontend=await bundle('../../astro-blog/src/lib/draw/rubricPresentation.ts','presentation');
const axes=scoring.rubricKeys,candidate=candidates.find(c=>c.id==='game-balanced');
const ratings=values=>Object.fromEntries(axes.map((k,i)=>[k,values[i]]));
const evidence=r=>Object.fromEntries(axes.map(k=>[k,r[k]===6?['明確な全体の根拠','区別される細部の根拠']:['見える部位と形の根拠']]));
test('production score matches adopted F on all 2401 profiles including zero, caps and rounding',()=>{
 for(let a=0;a<=6;a++)for(let b=0;b<=6;b++)for(let c=0;c<=6;c++)for(let d=0;d<=6;d++){const r=ratings([a,b,c,d]),out=scoring.computeGameScore(r);assert.equal(out.gameScore,candidateScore(r,candidate));assert.equal(out.score,Math.round(out.gameScore));}
 assert.deepEqual(scoring.computeGameScore(ratings([5,5,4,5])),{baseScore:78.6,gameScore:91.8,score:92});
 assert.equal(scoring.computeGameScore(ratings([0,0,0,0])).score,0);
});
test('validation never fabricates absent levels, preserves zero and requires distinct evidence for six',()=>{
 const r=ratings([0,1,2,3]);assert.deepEqual(scoring.validatePrimaryEvaluation({rubric:r,axis_evidence:evidence(r)}),r);
 for(const rubric of [{},ratings([7,3,3,3]),ratings([2.5,3,3,3]),{...r,subject_match:'3'},{...r,extra:0}])assert.throws(()=>scoring.validatePrimaryEvaluation({rubric,axis_evidence:evidence(r)}));
 const six=ratings([6,6,6,6]);assert.throws(()=>scoring.validatePrimaryEvaluation({rubric:six,axis_evidence:Object.fromEntries(axes.map(k=>[k,['same','same']]))}));
 assert.deepEqual(scoring.validatePrimaryEvaluation({rubric:six,axis_evidence:evidence(six)}),six);
});
const renderPath=join(dir,'render.cjs');
await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import ResultCard from './src/components/draw/ResultCard';export const render=(props)=>renderToStaticMarkup(React.createElement(ResultCard,props));`,resolveDir:resolve(root,'../../astro-blog'),loader:'tsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',outfile:renderPath});
const rendered=(await import(pathToFileURL(renderPath).href)).default;
test('result card renders valid progress widths and four levels, with old three-bar fallback',()=>{
 const props={score:92,shortComment:'耳と表情が明確です。',tips:['耳','表情'],imageDataUrl:'data:image/png;base64,',breakdown:{likeness:60,composition:70,originality:80}};
 const modern=rendered.render({...props,primaryRubric:ratings([5,5,4,5])});assert.ok(modern.includes('83.33333333333334%'));assert.ok(modern.includes(' / 6'));assert.ok(modern.includes('仕上がりの質'));assert.ok(!modern.includes('工夫'));const old=rendered.render(props);assert.ok(old.includes('width:60%'));assert.ok(old.includes('工夫'));assert.ok(!old.includes(' / 6'));
});
test('new and historical result presentation stay separate in standard and child modes',()=>{
 const r=ratings([5,4,3,2]),legacy={likeness:60,composition:70,originality:80};for(const child of [false,true]){const modern=frontend.rubricPresentation(r,legacy,child);assert.equal(modern.length,4);assert.deepEqual(modern.map(x=>x.value),[5,4,3,2]);assert.ok(modern.every(x=>x.max===6));assert.equal(frontend.rubricPresentation(undefined,legacy,child).length,3);}
});
// Handler is exercised with local service mocks. Never read credentials or contact AWS/OpenAI.
const replacements={
 'env':`export const DRAW_BUCKET='test',DRAW_TABLE='test',OPENAI_API_KEY_SECRET_ID='test',PRIMARY_MODEL_ID='gpt-5.6-luna',PRIMARY_PROVIDER='openai',OPENAI_REASONING_EFFORT='none',PRACTICE_SUBMISSION_TTL_DAYS=7,RATE_LIMIT_SUBMIT=5,SUBMISSION_TTL_DAYS=45,SECONDARY_QUEUE_URL='test',SECONDARY_MODEL_ID='gpt-6-luna',IMAGE_TTL_SECONDS=900,RATE_LIMIT_UPLOAD=10;`,
 'ddb':`export const ddb={send:async command=>{if(globalThis.ddbSend)return globalThis.ddbSend(command.input);if(command.input.Item){globalThis.savedItem=command.input.Item;return {};}return {Item:globalThis.detailItem};}};`,
 's3':`export const getObjectBuffer=async()=>Buffer.from('test image');export const createPutUrl=async(bucket,key,ttl,contentType)=>{globalThis.signedUpload={bucket,key,ttl,contentType};return 'https://example.invalid/put';};`,
 'rateLimit':`export const rateLimit=async()=>{};`,
 'secrets':`export const getSecretString=async()=> 'test-only-key';`,
 'ulid':`export const generateUlid=()=> 'generated-test';`,
 'image':`export const asPng=async bytes=>bytes;`,
 'inkGate':`export const computeInkRatio=()=>globalThis.inkRatio;export const isInkGateFail=r=>r===0;`,
 'cfSign':`export const buildSignedUrl=async()=> 'https://example.invalid/test.png';`,
 'ranking':`export const getCurrentRank=async()=>1;`,
};
const plugin={name:'local-services',setup(b){b.onResolve({filter:/^@aws-sdk\/client-sqs$/},()=>({path:'sqs',namespace:'sqs-test'}));b.onLoad({filter:/.*/,namespace:'sqs-test'},()=>({contents:'export class SendMessageCommand{constructor(input){this.input=input;}} export class SQSClient{async send(command){globalThis.queueMessages ||= [];globalThis.queueMessages.push(command.input);if(globalThis.queueFail)throw Error("Queue failed");return {};}}',loader:'js'}));b.onResolve({filter:/^@aws-sdk\/lib-dynamodb$/},()=>({path:'ddb-command',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export class PutCommand { constructor(input){this.input=input;} } export class GetCommand { constructor(input){this.input=input;} } export class UpdateCommand { constructor(input){this.input=input;} }',loader:'js'}));b.onLoad({filter:/\/lib\/(env|ddb|s3|rateLimit|secrets|ulid|image|inkGate|ranking|cfSign)\.ts$/},args=>({contents:replacements[args.path.split('/').at(-1).replace('.ts','')],loader:'ts'}));}};
const submit=await bundle('src/handlers/submit.ts','submit',[plugin]);
const detail=await bundle('src/handlers/submission.ts','detail',[plugin]);
test('detail exposes new rubric and score versions without changing historical fields',async()=>{
 const event={requestContext:{http:{method:'GET'}},queryStringParameters:{promptId:'prompt-2026-04',submissionId:'test'}};globalThis.detailItem={imageKey:'draw/prompt-2026-04/test.png',score:92,breakdown:{likeness:80,composition:65,originality:0},primaryRubric:ratings([5,5,4,5]),scoringVersion:'game-score-v1',promptVersion:'prompt-v3',rubricVersion:'rubric-v2',baseScore:78.6,gameScore:91.8,oneLiner:'review'};try{let out=JSON.parse((await detail.handler(event)).body);assert.equal(out.scoringVersion,'game-score-v1');assert.deepEqual(out.primaryRubric,globalThis.detailItem.primaryRubric);delete globalThis.detailItem.scoringVersion;out=JSON.parse((await detail.handler(event)).body);assert.equal(out.primaryRubric,undefined);assert.equal(out.score,92);assert.equal(out.oneLiner,'review');}finally{delete globalThis.detailItem;}
});
const decisions=await bundle('src/lib/decisions.ts','decisions',[plugin]);
const worker=await bundle('src/handlers/secondaryWorker.ts','worker',[plugin]);
const decisionData=r=>({model:'gpt-6-luna',answers:axes.map(k=>({name:k,type:'score',score:r[k],confidence:1,probabilities:Array.from({length:7},(_,value)=>({value,probability:value===r[k]?1:0}))})),usage:{input_tokens:100,output_tokens:0,total_tokens:100}});
import {requestBody,instructionHash} from '../../../tools/draw-evaluation/decisions.mjs';
test('production Decisions request is byte-equivalent to evaluated original instructions',()=>{
 assert.deepEqual(decisions.decisionsRequest('30秒で熊を描いて',Buffer.from('image')),requestBody({prompt_text:'30秒で熊を描いて'},Buffer.from('image')));
 assert.equal(decisions.decisionsInstructionHash,instructionHash);
 const raw=decisionData(ratings([3,4,5,6]));assert.deepEqual(decisions.parseDecisions(raw).ratings,ratings([3,4,5,6]));
 raw.answers[0].probabilities[0].probability=.4;assert.throws(()=>decisions.parseDecisions(raw));
 raw.answers[0].type='refusal';assert.throws(()=>decisions.parseDecisions(raw));
});
test('submit saves MAP/F before enqueue, handles duplicate, invalid API, queue failure and ink gate',async()=>{
 const priorFetch=globalThis.fetch,priorError=console.error;let calls=0;
 const r=ratings([5,5,4,5]);globalThis.inkRatio=1;globalThis.queueMessages=[];
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/decisions');assert.equal(JSON.parse(options.body).reasoning,undefined);return {ok:true,headers:new Headers(),json:async()=>decisionData(r)};};
 const month=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tokyo'}).slice(0,7);
 const event={requestContext:{http:{method:'POST'}},body:JSON.stringify({submissionId:'test',imageKey:`draw/prompt-${month}/test.png`})};
 try{
  let response=await submit.handler(event),out=JSON.parse(response.body);assert.equal(response.statusCode,200);assert.equal(out.score,92);assert.equal(out.gameScore,91.8);assert.deepEqual(out.primaryRubric,r);assert.equal(out.reviewStatus,'pending');assert.equal(out.oneLiner,'');assert.equal(savedItem.primaryAxisEvidence,null);assert.equal(savedItem.primaryProvider,'openai-decisions');assert.equal(savedItem.scoreSortKey.slice(0,3),'008');assert.equal(globalThis.queueMessages.length,1);
  globalThis.detailItem={...savedItem,reviewStatus:'done',oneLiner:'completed'};out=JSON.parse((await submit.handler(event)).body);assert.equal(out.oneLiner,'completed');assert.equal(calls,1);assert.equal(globalThis.queueMessages.length,1);delete globalThis.detailItem;
  console.error=()=>{};delete globalThis.savedItem;globalThis.fetch=async()=>({ok:true,headers:new Headers(),json:async()=>({answers:[]})});response=await submit.handler(event);assert.equal(response.statusCode,503);assert.equal(globalThis.savedItem,undefined);
  globalThis.fetch=async()=>({ok:true,headers:new Headers(),json:async()=>decisionData(r)});globalThis.queueFail=true;out=JSON.parse((await submit.handler(event)).body);assert.equal(out.score,92);assert.equal(out.reviewStatus,'failed');delete globalThis.queueFail;
  globalThis.inkRatio=0;globalThis.fetch=()=>{throw Error('Gate must not call AI');};out=JSON.parse((await submit.handler(event)).body);assert.equal(out.score,0);assert.equal(out.reviewStatus,'skipped');assert.equal(savedItem.scoringVersion,null);
 }finally{globalThis.fetch=priorFetch;console.error=priorError;for(const k of ['savedItem','detailItem','inkRatio','queueMessages','queueFail'])delete globalThis[k];}
});
test('async worker claims once, writes reviews only, and retries failures up to three attempts',async()=>{
 const priorFetch=globalThis.fetch,priorError=console.error;const updates=[];let row;
 globalThis.ddbSend=async input=>{if(!input.UpdateExpression)return {Item:row};updates.push(input);const v=input.ExpressionAttributeValues;if(input.UpdateExpression.includes('reviewLease = :lease')){row.reviewLease=v[':lease'];row.secondaryAttempts=v[':attempt'];}if(v[':done'])row.reviewStatus='done';if(v[':status']){row.reviewStatus=v[':status'];delete row.reviewLease;}return {};};
 const event={Records:[{messageId:'one',body:JSON.stringify({promptId:'prompt-2026-04',submissionId:'test'})}]};let request;
 const review={review:{summary:'顔が伝わります。',goodPoint:'耳が明確です。',improvement:'脚をまとめよう。',nextStep:'楽しく描こう。'},tips:['耳','表情'],childReview:{summary:'かおだね。',goodPoint:'みみが すてき。',improvement:'あしを まとめよう。',nextStep:'たのしく かこう。'},childTips:['みみ','かお']};
 try{
  row={reviewStatus:'pending',secondaryAttempts:0,imageKey:'test',promptText:'犬',primaryRubric:ratings([5,5,4,5]),score:92};
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');request=JSON.parse(options.body);return {ok:true,json:async()=>({model:'gpt-6-luna',output_text:JSON.stringify(review),usage:{input_tokens:100,output_tokens:100,total_tokens:200}})};};
  assert.deepEqual(await worker.handler(event),{batchItemFailures:[]});assert.equal(row.reviewStatus,'done');assert.equal(request.reasoning.effort,'none');assert.equal(request.text.format.schema.properties.rubric,undefined);assert.ok(updates.every(u=>!/(?:^|, )score(?:SortKey)?\s*=|primaryRubric\s*=|GSI1PK\s*=/.test(u.UpdateExpression)));const n=updates.length;await worker.handler(event);assert.equal(updates.length,n);
  row.reviewStatus='pending';row.secondaryAttempts=0;console.error=()=>{};globalThis.fetch=async()=>{throw Error('temporary');};
  assert.deepEqual(await worker.handler(event),{batchItemFailures:[{itemIdentifier:'one'}]});assert.equal(row.reviewStatus,'pending');assert.equal(row.secondaryAttempts,1);
  await worker.handler(event);assert.equal(row.secondaryAttempts,2);assert.deepEqual(await worker.handler(event),{batchItemFailures:[]});assert.equal(row.reviewStatus,'failed');assert.equal(row.secondaryAttempts,3);
 }finally{globalThis.fetch=priorFetch;console.error=priorError;delete globalThis.ddbSend;}
});
// Cleanup after all registered tests (top-level await import alone does not wait for tests).
import {after} from 'node:test';

const uploadUrl = await bundle('src/handlers/uploadUrl.ts','upload-url',[plugin]);
test('upload URL defaults to PNG, signs WebP with matching key/type, rejects other types',async()=>{
 try{
  for(const contentType of [undefined,'image/png','image/webp']){
   const response=await uploadUrl.handler({requestContext:{http:{method:'POST'}},body:JSON.stringify({promptId:'prompt-2026-04',...(contentType?{contentType}:{})})});
   assert.equal(response.statusCode,200);const data=JSON.parse(response.body),type=contentType||'image/png';
   assert.equal(data.contentType,type);assert.ok(data.imageKey.endsWith(type==='image/webp'?'.webp':'.png'));assert.equal(globalThis.signedUpload.contentType,type);assert.equal(globalThis.signedUpload.key,data.imageKey);
  }
  const response=await uploadUrl.handler({requestContext:{http:{method:'POST'}},body:JSON.stringify({contentType:'image/jpeg'})});assert.equal(response.statusCode,400);
 }finally{delete globalThis.signedUpload;}
});
test('submit accepts WebP keys and rejects mismatched submission IDs',async()=>{
 const priorFetch=globalThis.fetch;globalThis.inkRatio=1;globalThis.fetch=async()=>({ok:true,headers:new Headers(),json:async()=>decisionData(ratings([3,3,3,3]))});
 try{
  const event={requestContext:{http:{method:'POST'}},body:JSON.stringify({submissionId:'webp-test',imageKey:'draw/practice/prompt-2026-04/webp-test.webp'})};
  const response=await submit.handler(event);assert.equal(response.statusCode,200);assert.equal(globalThis.savedItem.imageKey,'draw/practice/prompt-2026-04/webp-test.webp');assert.equal(JSON.parse(response.body).score,70);
  event.body=JSON.stringify({submissionId:'other',imageKey:'draw/practice/prompt-2026-04/webp-test.webp'});assert.equal((await submit.handler(event)).statusCode,400);
 }finally{globalThis.fetch=priorFetch;for(const k of ['inkRatio','savedItem','queueMessages'])delete globalThis[k];}
});

after(()=>rm(dir,{recursive:true,force:true}));
