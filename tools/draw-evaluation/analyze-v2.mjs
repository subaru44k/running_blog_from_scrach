import {load,save,latestReview,spearman,summary} from './core.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),dir=resolve(process.argv[2]||resolve(here,'data')),db=load(resolve(dir,'dataset.json'));
const v1=db.evaluations.filter(e=>e.evaluator_type==='reference'&&e.rubric_version==='rubric-v1');
const v2=db.evaluations.filter(e=>e.evaluator_type==='reference'&&e.rubric_version==='rubric-v2');
const initial=v2.filter(e=>e.id.startsWith('sol-ref-v2-01-'));
if(initial.length!==42)throw Error('Expected the 42-work initial v2 experiment');
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
function distribution(entries){
 const values=entries.map(e=>e.calculated_score).sort((a,b)=>a-b);let ties=0,nonzeroTies=0,nonzeroPairs=0;
 for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){if(values[i]===values[j])ties++;if(values[i]>0&&values[j]>0){nonzeroPairs++;if(values[i]===values[j])nonzeroTies++;}}
 return {n:values.length,mean:avg(values),median:(values[20]+values[21])/2,min:values[0],max:values.at(-1),unique_scores:new Set(values).size,zero:values.filter(v=>v===0).length,hundred:values.filter(v=>v===100).length,tie_pairs:ties,total_pairs:values.length*(values.length-1)/2,tie_pair_rate:ties/(values.length*(values.length-1)/2),nonzero_tie_pair_rate:nonzeroTies/nonzeroPairs,histogram:Object.fromEntries(Array.from({length:10},(_,i)=>[`${i*10}-${(i+1)*10}${i===9?' inclusive':' exclusive'}`,values.filter(v=>v>=i*10&&(i===9?v<=100:v<(i+1)*10)).length]))};
}
const changes=initial.map(e=>{
 const old=v1.find(o=>o.drawing_id===e.drawing_id),review=latestReview(db,old.id);
 return {drawing_id:e.drawing_id,prompt:db.drawings.find(d=>d.id===e.drawing_id).prompt_text,v1:old.calculated_score,v2:e.calculated_score,v2_ratings:e.ratings,old_review:review?{status:review.status,note:review.note}:null};
});
const group=summary(db).groups.find(g=>JSON.parse(g.key)[5]==='rubric-v2');
const repeatWorks=group.works.filter(w=>w.repeats===3).map(w=>({...w,scores:v2.filter(e=>e.drawing_id===w.drawing_id).map(e=>e.calculated_score)}));
const agreements=Object.fromEntries(['subject_match','feature_capture','form_coherence','finish_quality'].map(axis=>[axis,avg(repeatWorks.map(w=>w.rubric_pair_agreement.find(a=>a.axis===axis).agreement))]));
const pairRank=[];for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)pairRank.push({runs:[a+1,b+1],n:repeatWorks.length,spearman:spearman(repeatWorks.map(w=>w.scores[a]),repeatWorks.map(w=>w.scores[b]))});
const report={created_at:new Date().toISOString(),scope:'Same 42 works; rubric/scoring/prompt all changed; not independent holdout',v1:distribution(v1),v2_initial:distribution(initial),initial_v1_v2_rank_correlation:spearman(changes.map(c=>c.v1),changes.map(c=>c.v2)),repeat_stability:{n:repeatWorks.length,repeats:3,mean_max_gap:avg(repeatWorks.map(w=>w.max_gap)),maximum_gap:Math.max(...repeatWorks.map(w=>w.max_gap)),axis_pair_agreement:agreements,pair_rank_correlations:pairRank,works:repeatWorks},v1_review_counts:Object.fromEntries(['valid','check','inappropriate'].map(s=>[s,v1.filter(e=>latestReview(db,e.id)?.status===s).length])),human_reviewed_changes:changes.filter(c=>c.old_review),all_changes:changes};
save(resolve(dir,'v2-analysis.json'),report);console.log(JSON.stringify({...report,human_reviewed_changes:undefined,all_changes:undefined},null,2));
