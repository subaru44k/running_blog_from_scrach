import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,isAbsolute,join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,ScanCommand,GetCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {S3Client,HeadObjectCommand,GetObjectCommand,PutObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
const [mode,dir]=process.argv.slice(2);
if(!['apply','purge'].includes(mode)||!dir||!isAbsolute(dir))throw Error('Usage: migrate-saved-images.mjs apply|purge <absolute assessment directory>');
process.env.AWS_PROFILE='codex-prod';
const table='DrawSubmissions',bucket='draw-uploads-20260124-58904f87',region='ap-northeast-1';
const ddb=DynamoDBDocumentClient.from(new DynamoDBClient({region})),s3=new S3Client({region});
const save=(name,x)=>writeFileSync(join(dir,name),JSON.stringify(x,null,2),{mode:0o600});
const load=name=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const manifest=load('manifest.json').filter(r=>r.changed);
const hash=b=>createHash('sha256').update(b).digest('hex');
const key=r=>({promptId:r.promptId,submissionId:r.submissionId});
async function scan(){let records=[],ExclusiveStartKey;do{const r=await ddb.send(new ScanCommand({TableName:table,ConsistentRead:true,ExclusiveStartKey}));records.push(...r.Items);ExclusiveStartKey=r.LastEvaluatedKey;}while(ExclusiveStartKey);return records;}
const snapshotFile='migration-snapshot.json';
if(!existsSync(join(dir,snapshotFile))){if(mode!=='apply')throw Error('No migration snapshot');save(snapshotFile,{createdAt:new Date().toISOString(),records:await scan()});}
const snapshot=load(snapshotFile);
const targets=manifest.map(r=>{const matches=snapshot.records.filter(x=>x.imageKey===r.Key);if(matches.length!==1)throw Error('Expected one saved record for '+r.Key);return {...r,record:matches[0],newKey:r.Key.replace(/\.png$/,'.webp')};});
const current=async r=>(await ddb.send(new GetCommand({TableName:table,Key:key(r),ConsistentRead:true}))).Item;
if(mode==='apply'){
 for(const r of targets){const actual=await current(r.record);if(!isDeepStrictEqual(actual,r.record)&&!isDeepStrictEqual(actual,{...r.record,imageKey:r.newKey}))throw Error('Concurrent change '+r.Key);}
 for(const r of targets){
  const original=readFileSync(join(dir,'originals',r.Key.split('/').at(-1))),body=readFileSync(join(dir,'compressed',r.outputName));
  if(!r.Key.endsWith('.png')||body.length>=original.length||original.length!==r.Size||body.length!==r.bytes||body.toString('ascii',0,4)!=='RIFF'||body.toString('ascii',8,12)!=='WEBP')throw Error('Invalid prepared image '+r.Key);
  const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:r.Key}));const old=await s3.send(new GetObjectCommand({Bucket:bucket,Key:r.Key,IfMatch:head.ETag}));
  if(hash(Buffer.from(await old.Body.transformToByteArray()))!==hash(original))throw Error('Original changed '+r.Key);
  try{await s3.send(new PutObjectCommand({Bucket:bucket,Key:r.newKey,Body:body,ContentType:'image/webp',CacheControl:head.CacheControl,Metadata:head.Metadata,IfNoneMatch:'*'}));}catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}
  const uploaded=await s3.send(new GetObjectCommand({Bucket:bucket,Key:r.newKey}));if(uploaded.ContentType!=='image/webp'||hash(Buffer.from(await uploaded.Body.transformToByteArray()))!==hash(body))throw Error('Uploaded content mismatch '+r.newKey);
  r.oldETag=head.ETag;r.originalSha256=hash(original);r.webpSha256=hash(body);
 }
 save('migration-plan.json',targets.map(({record,...r})=>({...r,...key(record)})));
 for(const r of targets){
  if(isDeepStrictEqual(await current(r.record),{...r.record,imageKey:r.newKey}))continue;
  await ddb.send(new UpdateCommand({TableName:table,Key:key(r.record),UpdateExpression:'SET imageKey = :new',ConditionExpression:'imageKey = :old',ExpressionAttributeValues:{':old':r.Key,':new':r.newKey}}));
 }
 if(!existsSync(join(dir,'references-switched.json')))save('references-switched.json',{switchedAt:new Date().toISOString(),count:targets.length,purgeNotBefore:new Date(Date.now()+900000).toISOString()});
 for(const r of snapshot.records){const m=targets.find(t=>t.Key===r.imageKey);if(!isDeepStrictEqual(await current(r),m?{...r,imageKey:m.newKey}:r))throw Error('Fields changed unexpectedly '+r.submissionId);}
 // Validate every migrated public detail and signed image without calling any AI.
 for(const r of targets){const url='https://2vzy10yq0e.execute-api.ap-northeast-1.amazonaws.com/api/draw/submission?'+new URLSearchParams(key(r.record));const resp=await fetch(url);if(!resp.ok)throw Error('Detail '+resp.status);const detail=await resp.json();
  if(detail.score!==r.record.score||detail.oneLiner!==(r.record.oneLiner||''))throw Error('Public score/review changed');
  const image=await fetch(detail.imageDataUrl);if(!image.ok||image.headers.get('content-type')!=='image/webp'||hash(Buffer.from(await image.arrayBuffer()))!==r.webpSha256)throw Error('Public image failed '+r.newKey);
 }
 save('migration-verified.json',{verifiedAt:new Date().toISOString(),count:targets.length,allOtherRecordFieldsUnchanged:true,allMigratedPublicImagesVerified:true});console.log('Migrated and publicly verified '+targets.length+' images; all other record fields unchanged.');
 console.log('Original PNG deletion allowed after '+load('references-switched.json').purgeNotBefore);
}else{
 if(!existsSync(join(dir,'migration-verified.json')))throw Error('Public verification not complete');
 if(Date.now()<Date.parse(load('references-switched.json').purgeNotBefore))throw Error('Signed URL grace period has not elapsed');
 const records=await scan();const plan=load('migration-plan.json');
 for(const r of plan){if(records.some(x=>x.imageKey===r.Key))throw Error('Original still referenced '+r.Key);const record=records.find(x=>x.promptId===r.promptId&&x.submissionId===r.submissionId);if(!record||record.imageKey!==r.newKey)throw Error('New reference missing');
  const image=await s3.send(new GetObjectCommand({Bucket:bucket,Key:r.newKey}));if(hash(Buffer.from(await image.Body.transformToByteArray()))!==r.webpSha256)throw Error('New image changed');
  if(hash(readFileSync(join(dir,'originals',r.Key.split('/').at(-1))))!==r.originalSha256)throw Error('Backup mismatch');
  try{await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:r.Key,IfMatch:r.oldETag}));}catch(e){if(e.name!=='NoSuchKey')throw e;}
 }
 save('migration-cleanup.json',{completedAt:new Date().toISOString(),deletedPngCount:plan.length});console.log('Original PNGs removed after grace period; local backups retained.');
}
