import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compare,assertSplit} from './luna-tuning.mjs';
const dir=new URL('./data/',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,dir)));
const freeze=new URL('luna-tuning-freeze.json',dir);
if(existsSync(freeze))throw Error('Selection already frozen; do not overwrite');
assertSplit(read('packet-luna-train.json').drawings,read('packet-luna-final.json').drawings);
const t=read('luna-training-targets.json'),teacher=t.map(t=>({drawing_id:t.drawing_id,ratings:t.teacher}));
const choices=[{version:'prompt-v3',file:'prompt-v3.md',metrics:compare(teacher,t.map(t=>({drawing_id:t.drawing_id,ratings:t.baseline})))}];
for(const v of process.argv.slice(2)){
 if(!['1','2'].includes(v))throw Error('Only two development revisions allowed');
 choices.push({version:`prompt-luna-v${v}`,file:`prompt-luna-v${v}.md`,metrics:compare(teacher,read(`tuning-train-v${v}.json`))});
}
choices.sort((a,b)=>a.metrics.ordinal_mae-b.metrics.ordinal_mae||a.metrics.game_mae-b.metrics.game_mae);
const selected=choices[0],hash=b=>createHash('sha256').update(b).digest('hex');
const result={created_at:new Date().toISOString(),selected_prompt:selected.version,prompt_file:selected.file,prompt_sha256:hash(readFileSync(new URL(selected.file,import.meta.url))),split_sha256:hash(readFileSync(new URL('luna-tuning-split.json',dir))),final_ids:read('luna-tuning-split.json').final_ids,selection_rule:'Development ordinal MAE, then F game MAE; final outputs unopened',development:choices};
writeFileSync(freeze,JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({selected:result.selected_prompt,metrics:Object.fromEntries(Object.entries(selected.metrics).filter(([k])=>k!=='rows'))},null,2));
