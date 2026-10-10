import {rubricAxes,score,latestReview,spearman,v2LevelValues} from './core.mjs';
export const axes=rubricAxes['rubric-v2'];
export const candidates=[
 {id:'baseline',label:'A：検証時の基準',weights:[40,25,20,15],values:v2LevelValues,description:'通常3＝45点、しっかり4＝65点、良い5＝82点。お題を重視。'},
 {id:'linear',label:'B：等間隔の換算',weights:[40,25,20,15],values:[0,100/6,200/6,50,400/6,500/6,100],description:'段階差を等間隔にする。低い段階にも点が入りやすい。'},
 {id:'quality',label:'C：品質を重視',weights:[35,20,25,20],values:v2LevelValues,description:'形と仕上がりを合わせて45％へ。お題＋特徴は55％。'},
 {id:'asymmetric',label:'D：基準に近い非対称重み',weights:[37,23,22,18],values:v2LevelValues,description:'基準から各軸2〜3％だけ調整。同点削減の効果と順位への影響を確認。'},
];
export const gameCandidates=[
 {id:'game-conservative',label:'E：控えめなゲーム補正',weights:[40,25,20,15],values:v2LevelValues,anchors:[[0,0],[15,30],[35,55],[45,65],[65,79],[82,95],[100,100]],description:'通常3＝65点、全軸4＝79点、全軸5＝95点。'},
 {id:'game-balanced',label:'F：推奨ゲーム補正',weights:[40,25,20,15],values:v2LevelValues,anchors:[[0,0],[15,35],[35,60],[45,70],[65,79],[82,95],[100,100]],description:'通常3＝70点、全軸4＝79点、全軸5＝95点。今回の平均・最高を目安にした固定換算。'},
 {id:'game-generous',label:'G：高めのゲーム補正',weights:[40,25,20,15],values:v2LevelValues,anchors:[[0,0],[15,40],[35,65],[45,75],[65,79],[82,95],[100,100]],description:'通常3＝75点。低〜中段階により多くの点を出す。全軸4＝79点、全軸5＝95点。'},
];
candidates.push(...gameCandidates);
export function gameTransform(value,anchors){
 if(!Number.isFinite(value)||value<0||value>100)throw Error('Invalid raw score');
 if(value===0)return 0;
 const index=anchors.findIndex(([x])=>x>=value);
 const [a,b]=anchors[index-1],[c,d]=anchors[index];
 return b+(value-a)*(d-b)/(c-a);
}
export function candidateScore(ratings,candidate){
 score(ratings,'score-v2');
 const weighted=axes.reduce((sum,k,i)=>sum+candidate.values[ratings[k]]*candidate.weights[i],0)/100;
 const raw=Math.round(Math.min([15,35,55,100,100,100,100][ratings.subject_match],weighted)*100)/100;
 return candidate.anchors?Math.round(gameTransform(raw,candidate.anchors)*100)/100:raw;
}
const average=xs=>xs.length?xs.reduce((s,v)=>s+v,0)/xs.length:null;
export function distribution(scores){
 let ties=0;for(let i=0;i<scores.length;i++)for(let j=i+1;j<scores.length;j++)if(scores[i]===scores[j])ties++;
 const pairs=scores.length*(scores.length-1)/2;
 return {n:scores.length,mean:average(scores),min:scores.length?Math.min(...scores):null,max:scores.length?Math.max(...scores):null,unique:new Set(scores).size,tied_pairs:ties,pairs,tie_rate:pairs?ties/pairs:null};
}
function metrics(rows,candidate){
 const scores=rows.map(r=>r.scores[candidate.id]),baseline=rows.map(r=>r.scores.baseline);
 let flipped=0,broken=0,newTies=0;
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=Math.sign(baseline[i]-baseline[j]),b=Math.sign(scores[i]-scores[j]);
  if(a&&b&&a!==b)flipped++;if(!a&&b)broken++;if(a&&!b)newTies++;
 }
 return {...distribution(scores),rounding:Object.fromEntries([0,1,2].map(d=>[d,distribution(scores.map(s=>Number(s.toFixed(d))))])),rank_correlation:spearman(baseline,scores),strict_order_flips:flipped,baseline_ties_broken:broken,new_tied_pairs:newTies,mean_absolute_change:average(scores.map((s,i)=>Math.abs(s-baseline[i])))};
}
export function buildComparison(db){
 const entries=db.evaluations.filter(e=>e.id.startsWith('sol-ref-p3-01-')&&e.prompt_version==='prompt-v3'&&e.rubric_version==='rubric-v2');
 const rows=entries.map(e=>({drawing_id:e.drawing_id,evaluation_id:e.id,prompt:db.drawings.find(d=>d.id===e.drawing_id).prompt_text,image_path:db.drawings.find(d=>d.id===e.drawing_id).image_path,ratings:e.ratings,review:latestReview(db,e.id)||null,scores:Object.fromEntries(candidates.map(c=>[c.id,candidateScore(e.ratings,c)]))}));
 const valid=rows.filter(r=>r.review?.status==='valid');
 const profiles=new Map();for(const r of rows){const key=axes.map(a=>r.ratings[a]).join('/');const group=profiles.get(key)||[];group.push(r.drawing_id);profiles.set(key,group);}
 const identical=[...profiles].filter(([,ids])=>ids.length>1).map(([ratings,drawing_ids])=>({ratings,drawing_ids}));
 const repeated=rows.map(r=>({row:r,es:db.evaluations.filter(e=>e.drawing_id===r.drawing_id&&e.prompt_version==='prompt-v3'&&e.run_id==='reference-p3-20261005-01')})).filter(r=>r.es.length===3);
 const repeat_metrics=Object.fromEntries(candidates.map(c=>[c.id,{n:repeated.length,mean_max_gap:average(repeated.map(r=>{const s=r.es.map(e=>candidateScore(e.ratings,c));return Math.max(...s)-Math.min(...s);})),maximum_gap:repeated.length?Math.max(...repeated.map(r=>{const s=r.es.map(e=>candidateScore(e.ratings,c));return Math.max(...s)-Math.min(...s);})):null}]));
 return {created_at:new Date().toISOString(),scope:'Adopted prompt-v3 first run; unchanged ratings and human reviews',candidates,counts:{all:rows.length,valid:valid.length,check:rows.filter(r=>r.review?.status==='check').length,inappropriate:rows.filter(r=>r.review?.status==='inappropriate').length,pending:rows.filter(r=>!r.review).length},metrics:{all:Object.fromEntries(candidates.map(c=>[c.id,metrics(rows,c)])),valid:Object.fromEntries(candidates.map(c=>[c.id,metrics(valid,c)]))},identical_rating_groups:identical,unavoidable_identical_pairs:identical.reduce((s,g)=>s+g.drawing_ids.length*(g.drawing_ids.length-1)/2,0),repeat_metrics,rows};
}
