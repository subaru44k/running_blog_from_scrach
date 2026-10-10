import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {requestBody,parseDecision,instructionHash} from './decisions.mjs';
const here=dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2),execute=args.includes('--execute');
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const out=resolve(option('--out',resolve(here,'data/decisions-20261009')));if(existsSync(out))throw Error('Use a new output directory');
const db=JSON.parse(readFileSync(resolve(here,'data/dataset.json'))),split=JSON.parse(readFileSync(resolve(here,'data/luna56-tuning-split.json')));
const ids=[...split.train_ids,...split.final_ids];if(new Set(ids).size!==35)throw Error('Expected fixed 35 works');
const drawings=ids.map(id=>{const d=db.drawings.find(d=>d.id===id);if(!d)throw Error('Missing image');return d;});
const sha=b=>createHash('sha256').update(b).digest('hex');const payloads=drawings.map(d=>{const bytes=readFileSync(resolve(here,'data',d.image_path));if(sha(bytes)!==d.image_sha256||bytes.readUInt32BE(16)>4096||bytes.readUInt32BE(20)>4096)throw Error('Image hash/size mismatch');return requestBody(d,bytes);});
// Conservative reservation: 100k input tokens per short single-image request at $0.10/M.
const reservePerRequest=.01,requestCount=drawings.length*2+1;
const plan={created_at:new Date().toISOString(),model:'gpt-6-luna',endpoint:'https://api.openai.com/v1/decisions',instruction_sha256:instructionHash,drawings:drawings.map(d=>({id:d.id,image_sha256:d.image_sha256})),development_ids:split.train_ids,check_ids:split.final_ids,repeats:2,warmup:1,max_requests:requestCount,reserved_usd:requestCount*reservePerRequest,price_usd_per_million_input_tokens:.10,notes:['Reservation is an estimate, not an account-side billing limit','18 check teacher labels are not human validated','No Responses latency comparison; subscription agent durations are not API benchmarks']};
if(execute&&(!args.includes('--allow-paid-api')||Number(option('--max-cost-usd','0'))<plan.reserved_usd))throw Error('Explicit paid-API authorization and sufficient budget required');
mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'plan.json'),JSON.stringify(plan,null,2),{mode:0o600});
if(!execute){console.log(JSON.stringify({dry_run:true,requests:requestCount,reserved_usd:plan.reserved_usd,plan:resolve(out,'plan.json'),network_calls:0}));process.exit(0);}
let key=process.env.OPENAI_API_KEY;const secretId=option('--secret-id','');
if(!key&&secretId){const require=createRequire(resolve(here,'../../backend/draw/package.json'));const {SecretsManagerClient,GetSecretValueCommand}=require('@aws-sdk/client-secrets-manager');const s=await new SecretsManagerClient({region:'ap-northeast-1'}).send(new GetSecretValueCommand({SecretId:secretId}));key=s.SecretString;try{const parsed=JSON.parse(key);key=parsed.apiKey||parsed.OPENAI_API_KEY||parsed.key;}catch{}}
if(typeof key!=='string'||!key.trim())throw Error('Existing API credential unavailable; no key is printed');
const records=[];let calls=0;
for(let repeat=-1;repeat<2;repeat++){for(let i=0;i<(repeat===-1?1:drawings.length);i++){
 const started=new Date().toISOString(),start=performance.now();let entry={drawing_id:drawings[i].id,image_sha256:drawings[i].image_sha256,repeat,warmup:repeat===-1,started_at:started};
 try{const response=await fetch(plan.endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payloads[i]),signal:AbortSignal.timeout(30000)});calls++;entry.latency_ms=performance.now()-start;entry.http_status=response.status;entry.request_id=response.headers.get('x-request-id');if(!response.ok){entry.error='HTTP '+response.status;}else{const raw=await response.json();entry.raw=raw;entry.usage=raw.usage;try{entry.parsed=parseDecision(raw);}catch{entry.error='Response validation failed';}}}catch{calls++;entry.latency_ms=performance.now()-start;entry.error='Network error or timeout';}
 entry.latency_ms=performance.now()-start;
 records.push(entry);writeFileSync(resolve(out,'results.json'),JSON.stringify(records,null,2),{mode:0o600});console.log(JSON.stringify({call:calls,total:requestCount,status:entry.error||'ok',latency_ms:Math.round(entry.latency_ms)}));
 if(entry.http_status===401||entry.http_status===403||entry.http_status===404||entry.http_status===429||entry.error==='Response validation failed')throw Error('Stopping on authentication, availability, rate-limit or response contract failure; raw result retained');
}}
