import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const root=resolve(import.meta.dirname,'..');
const config=JSON.parse(execFileSync('aws',['lambda','get-function-configuration','--profile','codex-prod','--region','ap-northeast-1','--function-name','draw-submit-prod'],{encoding:'utf8'}));
Object.assign(process.env,config.Environment.Variables,{AWS_PROFILE:'codex-prod',AWS_REGION:'ap-northeast-1',OPENAI_REASONING_EFFORT:'none'});
const dir=mkdtempSync(join(tmpdir(),'draw-preflight-'));
try{
 const outfile=join(dir,'preflight.cjs');await build({stdin:{contents:`export {scoreWithDecisions} from './src/lib/decisions.ts'; export {invokeOpenAIJson} from './src/lib/openai.ts'; export {reviewSystem,reviewInput,reviewSchema,normalizeReview} from './src/lib/review.ts';export {computeGameScore} from './src/lib/gameScore.ts';`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'cjs',loader:{'.md':'text'},outfile});
 const api=createRequire(import.meta.url)(outfile);
 const db=JSON.parse(readFileSync(resolve(root,'../../tools/draw-evaluation/data/dataset.json')));const drawing=db.drawings.find(d=>d.id==='2026-04-01KPM5CRBEVF2Q0M5ZHCX39WGK');
 const bytes=readFileSync(resolve(root,'../../tools/draw-evaluation/data',drawing.image_path));let start=Date.now();const score=await api.scoreWithDecisions(drawing.prompt_text,bytes);const scoreMs=Date.now()-start;
 start=Date.now();const review=await api.invokeOpenAIJson('gpt-6-luna',api.reviewSystem,api.reviewInput(drawing.prompt_text,bytes,score.ratings),api.reviewSchema);const reviewMs=Date.now()-start;
 const result={drawing_id:drawing.id,score_model:score.modelId,ratings:score.ratings,...api.computeGameScore(score.ratings),score_latency_ms:scoreMs,score_usage:score.usage,review_model:review.modelId,review_latency_ms:reviewMs,review_usage:review.usage,review:api.normalizeReview(review.data),created_at:new Date().toISOString()};
 writeFileSync(resolve(root,'../../tools/draw-evaluation/data/decisions-production-preflight.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{rmSync(dir,{recursive:true,force:true});}
