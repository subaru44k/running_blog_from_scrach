import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compare,assertSplit} from './luna-tuning.mjs';
const dir=new URL('./data/',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,dir)));
const path=new URL('luna56-tuning-freeze.json',dir);if(existsSync(path))throw Error('Selection already frozen');
const train=read('packet-luna-train.json').drawings,final=JSON.parse(readFileSync(new URL('./data-luna56-fresh/packet-final.json',import.meta.url))).drawings;assertSplit(train,final);
const targets=read('luna-training-targets.json'),teacher=targets.map(t=>({drawing_id:t.drawing_id,image_sha256:train.find(d=>d.id===t.drawing_id)?.image_sha256,ratings:t.teacher}));
const metrics=(n,prompt)=>{const a=read(n);if(a.some(e=>e.model!=='gpt-5.6-luna'||e.reasoning_effort!=='low'||e.evaluator_type!=='candidate'||e.prompt_version!==prompt))throw Error('Invalid candidate provenance');return compare(teacher,a);};
const choices=[{version:'prompt-v3',file:'prompt-v3.md',metrics:metrics('luna56-train-baseline.json','prompt-v3')}];
for(const v of process.argv.slice(2)){if(!['1','2'].includes(v))throw Error('Only two prompt revisions allowed');choices.push({version:`prompt-luna56-v${v}`,file:`prompt-luna56-v${v}.md`,metrics:metrics(`luna56-train-v${v}.json`,`prompt-luna56-v${v}`)});}
choices.sort((a,b)=>a.metrics.ordinal_mae-b.metrics.ordinal_mae||a.metrics.game_mae-b.metrics.game_mae);
const selected=choices[0],hash=b=>createHash('sha256').update(b).digest('hex');
const result={created_at:new Date().toISOString(),model:'gpt-5.6-luna',reasoning_effort:'low',selected_prompt:selected.version,prompt_file:selected.file,prompt_sha256:hash(readFileSync(new URL(selected.file,import.meta.url))),split_sha256:hash(readFileSync(new URL('luna56-tuning-split.json',dir))),final_ids:final.map(d=>d.id),selection_rule:'Train ordinalMAE then FpointMAE; fresh final outputs unopened',development:choices};writeFileSync(path,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({selected:result.selected_prompt,development:choices.map(c=>({version:c.version,ordinal_mae:c.metrics.ordinal_mae,game_mae:c.metrics.game_mae}))},null,2));
