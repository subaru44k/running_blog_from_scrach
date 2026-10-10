import adoptedPrompt from '../../../../tools/draw-evaluation/prompt-v3.md';
import rubric from '../../../../tools/draw-evaluation/rubric-v2.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { rubricKeys, type PrimaryRubric } from './gameScore.js';
import { OPENAI_API_KEY_SECRET_ID } from './env.js';
import { getSecretString } from './secrets.js';
import type { OpenAiUsage } from './openai.js';
export const decisionsInstructions = adoptedPrompt.split('各軸のaxis_evidence')[0] + '\n' + rubric.rules.join('\n');
export const decisionsInstructionHash = createHash('sha256').update(decisionsInstructions + JSON.stringify(rubric)).digest('hex');
export const decisionsVersions = {promptVersion:'decisions-original-v1', rubricVersion:'rubric-v2', scoringVersion:'game-score-v1'} as const;
export const decisionsRequest = (promptText: string, bytes: Buffer) => ({
 model:'gpt-6-luna',
 input:[{role:'user',content:[{type:'input_text',text:`お題: ${promptText}\n${decisionsInstructions}\n総合点や講評は不要。各質問に画像で見える状態のみから答える。`},{type:'input_image',image_url:`data:image/png;base64,${bytes.toString('base64')}`}]}],
 questions:rubricKeys.map(name=>({type:'score',name,instructions:`${rubric.axes[name].label}を他の軸から独立に判定。段階の存在と質を区別する。`,levels:rubric.axes[name].levels.map((description,i)=>({label:String(i),description}))})),
});
export function parseDecisions(data: any) {
 if(data?.model!=='gpt-6-luna'||!Array.isArray(data.answers)||data.answers.length!==4)throw Error('Invalid Decisions model/answers');
 const ratings={} as PrimaryRubric,means={} as PrimaryRubric,probabilities={} as Record<string,number[]>,confidence={} as Record<string,number>;
 for(const k of rubricKeys){
  const matches=data.answers.filter((a:any)=>a.name===k);if(matches.length!==1)throw Error('Missing/duplicate axis');const a=matches[0];
  if(a.type!=='score'||!Array.isArray(a.probabilities)||a.probabilities.length!==7)throw Error('Invalid/refused score');
  const p=Array<number>(7);for(const e of a.probabilities){if(!Number.isInteger(e.value)||e.value<0||e.value>6||p[e.value]!==undefined||!Number.isFinite(e.probability)||e.probability<0||e.probability>1)throw Error('Invalid level probability');p[e.value]=e.probability;}
  const sum=p.reduce((s,v)=>s+v,0),mean=p.reduce((s,v,i)=>s+v*i,0);if(Math.abs(sum-1)>.001||!Number.isFinite(a.score)||Math.abs(a.score-mean)>.03||!Number.isFinite(a.confidence)||a.confidence<0||a.confidence>1)throw Error('Invalid distribution/score/confidence');
  ratings[k]=p.indexOf(Math.max(...p));means[k]=a.score;probabilities[k]=p;confidence[k]=a.confidence;
 }
 return {ratings,means,probabilities,confidence};
}
export async function scoreWithDecisions(promptText:string,bytes:Buffer){
 const key=await getSecretString(OPENAI_API_KEY_SECRET_ID);
 const response=await fetch('https://api.openai.com/v1/decisions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(decisionsRequest(promptText,bytes)),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error(`Decisions HTTP ${response.status}`);
 const raw:any=await response.json();const parsed=parseDecisions(raw);
 const usage:OpenAiUsage={inputTokens:raw.usage?.input_tokens??null,cachedInputTokens:raw.usage?.input_tokens_details?.cached_tokens??null,cacheWriteTokens:raw.usage?.input_tokens_details?.cache_write_tokens??null,outputTokens:raw.usage?.output_tokens??null,totalTokens:raw.usage?.total_tokens??null};
 return {...parsed,modelId:raw.model,usage,requestId:response.headers.get('x-request-id'),estimatedCostUsd:typeof usage.inputTokens==='number'?Number((usage.inputTokens*.1/1e6).toFixed(8)):null};
}
