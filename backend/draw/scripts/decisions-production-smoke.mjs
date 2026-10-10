import {readFileSync,writeFileSync} from 'node:fs';import {resolve}from 'node:path';
import {DynamoDBClient}from '@aws-sdk/client-dynamodb';import {DynamoDBDocumentClient,GetCommand,DeleteCommand}from '@aws-sdk/lib-dynamodb';import {S3Client,DeleteObjectCommand}from '@aws-sdk/client-s3';
const base='https://2vzy10yq0e.execute-api.ap-northeast-1.amazonaws.com',origin='https://subaru-is-running.com';
const root=resolve(import.meta.dirname,'../../..'),out=resolve(root,'data/draw-decisions-deploy-20261009');
const ddb=DynamoDBDocumentClient.from(new DynamoDBClient({region:'ap-northeast-1'})),s3=new S3Client({region:'ap-northeast-1'});
const headers={'Content-Type':'application/json',Origin:origin};let uploaded;
async function request(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Smoke HTTP '+r.status);return r.json();}
try{
 uploaded=await request('/api/draw/upload-url',{promptId:'prompt-2026-04',month:'2026-04'});
 if(uploaded.rankingEligible!==false||!uploaded.imageKey.startsWith('draw/practice/prompt-2026-04/'))throw Error('Must be practice');
 writeFileSync(resolve(out,'smoke-key.json'),JSON.stringify({promptId:'prompt-2026-04',submissionId:uploaded.submissionId,imageKey:uploaded.imageKey}));
 const bytes=readFileSync(resolve(root,'tools/draw-evaluation/data/images/2026-04-01KPM5CRBEVF2Q0M5ZHCX39WGK.png'));
 const put=await fetch(uploaded.putUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes,signal:AbortSignal.timeout(15000)});if(!put.ok)throw Error('Image PUT failed');
 let start=Date.now();const first=await request('/api/draw/submit',{promptId:'prompt-2026-04',submissionId:uploaded.submissionId,imageKey:uploaded.imageKey,nickname:'deployment-smoke'});const submitMs=Date.now()-start;
 if(first.reviewStatus!=='pending'||first.rankingEligible!==false||first.scoringVersion!=='game-score-v1'||!first.primaryRubric)throw Error('Invalid initial result');
 console.log(JSON.stringify({phase:'score_returned',score:first.score,reviewStatus:first.reviewStatus,submit_ms:submitMs,rankingEligible:first.rankingEligible}));
 let detail;const observations=[];for(let n=0;n<45;n++){await new Promise(r=>setTimeout(r,2000));detail=await request(`/api/draw/submission?promptId=prompt-2026-04&submissionId=${uploaded.submissionId}`);observations.push({elapsed_ms:Date.now()-start,status:detail.reviewStatus});if(detail.reviewStatus!=='pending')break;}
 if(detail.reviewStatus!=='done'||!detail.oneLiner||!detail.childOneLiner)throw Error('Async review did not complete');
 if(detail.score!==first.score||Object.entries(first.primaryRubric).some(([key,value])=>detail.primaryRubric[key]!==value))throw Error('Review changed score');
 const duplicate=await request('/api/draw/submit',{promptId:'prompt-2026-04',submissionId:uploaded.submissionId,imageKey:uploaded.imageKey});if(duplicate.score!==first.score||duplicate.oneLiner!==detail.oneLiner||duplicate.reviewStatus!=='done')throw Error('Duplicate not stable');
 const item=(await ddb.send(new GetCommand({TableName:'DrawSubmissions',Key:{promptId:'prompt-2026-04',submissionId:uploaded.submissionId},ConsistentRead:true}))).Item;
 if(item.primaryModelId!=='gpt-6-luna'||item.primaryProvider!=='openai-decisions'||item.secondaryModelId!=='gpt-6-luna'||item.GSI1PK)throw Error('Wrong provenance/ranking');
 const result={created_at:new Date().toISOString(),submit_ms:submitMs,initial:first,completed:detail,observations,primaryModelId:item.primaryModelId,secondaryModelId:item.secondaryModelId,secondaryAttempts:item.secondaryAttempts,primaryEstimatedCostUsd:item.primaryEstimatedCostUsd,secondaryEstimatedCostUsd:item.secondaryEstimatedCostUsd,duplicate_verified:true};delete result.completed.imageDataUrl;
 writeFileSync(resolve(out,'smoke-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({phase:'review_done',score:detail.score,review:detail.oneLiner,childReview:detail.childOneLiner,attempts:item.secondaryAttempts,observations,models:[item.primaryModelId,item.secondaryModelId],duplicate_verified:true}));
}finally{if(uploaded?.imageKey?.startsWith('draw/practice/prompt-2026-04/')){await s3.send(new DeleteObjectCommand({Bucket:'draw-uploads-20260124-58904f87',Key:uploaded.imageKey}));await ddb.send(new DeleteCommand({TableName:'DrawSubmissions',Key:{promptId:'prompt-2026-04',submissionId:uploaded.submissionId}}));console.log('Removed only this smoke-test practice record and image');}}
