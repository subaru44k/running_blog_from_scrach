// Only Query/GetObject are used. No Secrets Manager, AI clients, or production writes.
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { load, save } from './core.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../backend/draw/package.json'));
const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
const {DynamoDBDocumentClient,QueryCommand}=require('@aws-sdk/lib-dynamodb');
const {S3Client,GetObjectCommand}=require('@aws-sdk/client-s3');
const {build}=require('esbuild');
// Reuse the authoritative monthly prompt instead of duplicating its topic sequence.
const bundle=await build({entryPoints:[resolve(here,'../../backend/draw/src/lib/prompt.ts')],bundle:true,write:false,platform:'node',format:'esm'});
const {resolveDrawPrompt}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const args=process.argv.slice(2), out=resolve(args.shift()||resolve(here,'data'));
const excludeIndex=args.indexOf('--exclude');
const excluded=excludeIndex>=0?load(resolve(args.splice(excludeIndex,2)[1])):{drawings:[]};
const excludedIds=new Set(excluded.drawings.map(d=>d.id)), excludedHashes=new Set(excluded.drawings.map(d=>d.image_sha256)), seenHashes=new Set();
const months=args.length?args:Array.from({length:9},(_,i)=>`2026-${String(i+2).padStart(2,'0')}`);
if(months.some(m=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)))throw Error('Months must be YYYY-MM');
const path=resolve(out,'dataset.json');
if(existsSync(path))throw Error('Output dataset already exists; use another directory to preserve evaluations/reviews');
mkdirSync(resolve(out,'images'),{recursive:true});
const region=process.env.AWS_REGION||'ap-northeast-1',table=process.env.DRAW_TABLE||'DrawSubmissions',bucket=process.env.DRAW_BUCKET||'draw-uploads-20260124-58904f87';
const ddb=DynamoDBDocumentClient.from(new DynamoDBClient({region}));
const s3=new S3Client({region,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
const db={schema_version:1,drawings:[],evaluations:[],reviews:[],selection:{method:'Five score quantiles per month, then nearest available score neighbors; deterministic ID tie-break; up to 45 works',bias:'Past months retain Top20 only. No claim of population representativeness or coverage of blank/off-topic categories.',months:[],missing_images:[],excluded_images:[]}};
for(const month of months){
 const items=[];let cursor;
 do{const r=await ddb.send(new QueryCommand({TableName:table,KeyConditionExpression:'promptId = :p',ExpressionAttributeValues:{':p':`prompt-${month}`},ExclusiveStartKey:cursor}));items.push(...(r.Items||[]));cursor=r.LastEvaluatedKey;}while(cursor);
 db.selection.excluded_images.push(...items.filter(i=>excludedIds.has(`${month}-${i.submissionId}`)).map(i=>({month,id:`${month}-${i.submissionId}`,reason:'previous-drawing-id'})));
 const sorted=items.filter(i=>i.imageKey && Number.isFinite(i.score) && !excludedIds.has(`${month}-${i.submissionId}`)).sort((a,b)=>a.score-b.score||a.submissionId.localeCompare(b.submissionId));
 const used=new Set();let count=0;
 for(const q of [0,.25,.5,.75,1]){
  if(!sorted.length)break;
  const index=Math.round(q*(sorted.length-1));
  const candidates=sorted.map((item,i)=>({item,distance:Math.abs(i-index)})).sort((a,b)=>a.distance-b.distance||a.item.submissionId.localeCompare(b.item.submissionId));
  for(const {item} of candidates){
   if(used.has(item.submissionId))continue;used.add(item.submissionId);
   let bytes;
   try{const r=await s3.send(new GetObjectCommand({Bucket:bucket,Key:item.imageKey}));bytes=Buffer.from(await r.Body.transformToByteArray());}
   catch(error){if(error.name==='NoSuchKey'||error.$metadata?.httpStatusCode===404){db.selection.missing_images.push({month,id:item.submissionId});continue;}throw error;}
   if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Expected PNG');
   const id=`${month}-${item.submissionId}`;
   if(!/^[a-zA-Z0-9-]+$/.test(id))throw Error('Unsafe drawing ID');
   const image_path=`images/${id}.png`,hash=createHash('sha256').update(bytes).digest('hex');
   if(excludedHashes.has(hash)||seenHashes.has(hash)){db.selection.excluded_images.push({month,id,reason:excludedHashes.has(hash)?'previous-image-hash':'duplicate-image-hash'});continue;}
   seenHashes.add(hash);
   writeFileSync(resolve(out,image_path),bytes,{mode:0o600});
   db.drawings.push({id,prompt_id:item.promptId,prompt_text:item.promptText||resolveDrawPrompt({month}).promptText,image_path,image_sha256:hash,created_at:item.createdAt||'',time_limit_seconds:30,source:{table,bucket,image_key:item.imageKey},sample_quantile:q});
   db.evaluations.push({id:`saved-${id}`,drawing_id:id,evaluator_type:'production-saved',model:item.primaryModelId||'unknown',model_version:item.primaryModelId||'unknown',reasoning_effort:'unknown (not persisted)',execution_source:'historical-record',prompt_version:'unknown (not persisted)',rubric_version:'production-6axis',scoring_version:'historical-stored-score',run_id:'saved-production',ratings:item.primaryRubric||null,calculated_score:item.score,confidence:null,positive_points:[],improvement_points:[],visual_observations:[],short_reason:item.oneLiner||'',created_at:item.createdAt||'',fallback_used:item.aiFallbackUsed??null});
   count++;break;
  }
 }
 db.selection.months.push({month,rows:items.length,selected:count});console.log(`${month}: ${items.length} records, ${count} selected`);
}
save(path,db);
const packet={dataset_sha256:createHash('sha256').update(JSON.stringify(db.drawings.map(d=>[d.id,d.image_sha256]))).digest('hex'),drawings:db.drawings.map(({id,prompt_text,image_path,image_sha256,time_limit_seconds})=>({id,prompt_text,image_path,image_sha256,time_limit_seconds}))};
save(resolve(out,'packet.json'),packet);
console.log(`Saved ${db.drawings.length} works to ${out}; ${db.selection.missing_images.length} missing images`);
