import {axes,candidateScore,candidates} from './score-candidates.mjs';
import {spearman} from './core.mjs';
export function compare(teacher,candidate){
 const map=new Map(candidate.map(e=>[e.drawing_id,e]));
 if(!teacher.length||new Set(teacher.map(e=>e.drawing_id)).size!==teacher.length||map.size!==candidate.length||teacher.length!==candidate.length)throw Error('Incomplete or duplicate candidate');
 const f=candidates.find(c=>c.id==='game-balanced');
 const rows=teacher.map(t=>{const c=map.get(t.drawing_id);if(!c||t.image_sha256&&t.image_sha256!==c.image_sha256)throw Error('ID/hash mismatch');const deltas=axes.map(k=>Math.abs(t.ratings[k]-c.ratings[k]));return {drawing_id:t.drawing_id,teacher:t.ratings,candidate:c.ratings,axis_deltas:deltas,teacher_score:candidateScore(t.ratings,f),candidate_score:candidateScore(c.ratings,f)};});
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 return {n:rows.length,ordinal_mae:mean(rows.flatMap(r=>r.axis_deltas)),axis_mae:Object.fromEntries(axes.map((k,i)=>[k,mean(rows.map(r=>r.axis_deltas[i]))])),game_mae:mean(rows.map(r=>Math.abs(r.teacher_score-r.candidate_score))),rank_correlation:spearman(rows.map(r=>r.teacher_score),rows.map(r=>r.candidate_score)),exact_profiles:rows.filter(r=>r.axis_deltas.every(v=>v===0)).length,within_five:rows.filter(r=>Math.abs(r.teacher_score-r.candidate_score)<=5).length,large_axis_disagreements:rows.filter(r=>r.axis_deltas.some(v=>v>=2)).length,rows};
}
export function assertSplit(train,final){
 const ids=new Set(),hashes=new Set();
 for(const d of [...train,...final]){if(ids.has(d.id)||hashes.has(d.image_sha256))throw Error('Duplicate drawing or image across split');ids.add(d.id);hashes.add(d.image_sha256);}
}
