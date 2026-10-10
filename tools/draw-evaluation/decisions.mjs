import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {axes,candidateScore,candidates} from './score-candidates.mjs';
const rubric=JSON.parse(readFileSync(new URL('./rubric-v2.json',import.meta.url)));
const prompt=readFileSync(new URL('./prompt-v3.md',import.meta.url),'utf8').split('各軸のaxis_evidence')[0];
export const instructions=prompt+'\n'+rubric.rules.join('\n');
export const instructionHash=createHash('sha256').update(instructions+JSON.stringify(rubric)).digest('hex');
export function requestBody(drawing,bytes){
 return {model:'gpt-6-luna',input:[{role:'user',content:[{type:'input_text',text:`お題: ${drawing.prompt_text}\n${instructions}\n総合点や講評は不要。各質問に画像で見える状態のみから答える。`},{type:'input_image',image_url:`data:image/png;base64,${bytes.toString('base64')}`}]}],questions:axes.map(name=>({type:'score',name,instructions:`${rubric.axes[name].label}を他の軸から独立に判定。段階の存在と質を区別する。`,levels:rubric.axes[name].levels.map((description,i)=>({label:String(i),description}))}))};
}
export function parseDecision(data){
 if(!Array.isArray(data.answers)||data.answers.length!==axes.length)throw Error('Expected four answers');
 const means={},map={},probabilities={},confidence={};
 for(const name of axes){const answers=data.answers.filter(a=>a.name===name);if(answers.length!==1)throw Error('Missing/duplicate axis');const a=answers[0];
  if(a.type!=='score')throw Error(`Non-score or refusal: ${name}`);
  if(!Array.isArray(a.probabilities)||a.probabilities.length!==7)throw Error('Expected seven levels');
  const p=Array(7);for(const e of a.probabilities){if(!Number.isInteger(e.value)||e.value<0||e.value>6||p[e.value]!==undefined||!Number.isFinite(e.probability)||e.probability<0||e.probability>1)throw Error('Invalid probability');p[e.value]=e.probability;}
  const sum=p.reduce((s,v)=>s+v,0),mean=p.reduce((s,v,i)=>s+v*i,0);if(Math.abs(sum-1)>.001||!Number.isFinite(a.score)||Math.abs(a.score-mean)>.03||!Number.isFinite(a.confidence)||a.confidence<0||a.confidence>1)throw Error('Invalid score/confidence/distribution');
  probabilities[name]=p;means[name]=a.score;map[name]=p.indexOf(Math.max(...p));confidence[name]=a.confidence;
 }
 return {means,map,probabilities,confidence,game_score_map:candidateScore(map,candidates.find(c=>c.id==='game-balanced'))};
}
