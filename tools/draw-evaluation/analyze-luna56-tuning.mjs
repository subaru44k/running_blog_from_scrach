import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compare} from './luna-tuning.mjs';
const dir=new URL('./data/',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,dir))),hash=b=>createHash('sha256').update(b).digest('hex');const f=read('luna56-tuning-freeze.json');
if(hash(readFileSync(new URL(f.prompt_file,import.meta.url)))!==f.prompt_sha256||hash(readFileSync(new URL('luna56-tuning-split.json',dir)))!==f.split_sha256)throw Error('Frozen selection changed');
const t=read('luna56-fresh-sol.json');if(t.length!==f.final_ids.length||t.some(e=>!f.final_ids.includes(e.drawing_id)))throw Error('Wrong final teacher set');
if(t.some(e=>e.model!=='gpt-6.1-sol'||e.reasoning_effort!=='low'||e.evaluator_type!=='reference'||e.prompt_version!=='prompt-v3'))throw Error('Invalid teacher provenance');
const candidate=(file,prompt)=>{const a=read(file);if(a.some(e=>e.model!=='gpt-5.6-luna'||e.reasoning_effort!=='low'||e.evaluator_type!=='candidate'||e.prompt_version!==prompt))throw Error('Invalid candidate condition');return a;};
const result={freeze:f,final_baseline:compare(t,candidate('luna56-fresh-baseline.json','prompt-v3')),final_selected:compare(t,candidate('luna56-fresh-selected.json',f.selected_prompt)),limitations:['Sol fresh teacher not human validated','Retained historical Top20; six months only, no dog/rabbit/dolphin fresh samples','Subscription low; API none and response latency not verified']};writeFileSync(new URL('luna56-tuning-analysis.json',dir),JSON.stringify(result,null,2));console.log(JSON.stringify(Object.fromEntries(['final_baseline','final_selected'].map(k=>[k,Object.fromEntries(Object.entries(result[k]).filter(([n])=>n!=='rows'))])),null,2));
