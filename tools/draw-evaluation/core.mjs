import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export const axes = ['subject_match', 'structure', 'completion'];
export const rubricAxes = {
  'rubric-v1': axes,
  'rubric-v2': ['subject_match', 'feature_capture', 'form_coherence', 'finish_quality'],
};
const versionTriplets = [['prompt-v1','rubric-v1','score-v1'], ['prompt-v2','rubric-v2','score-v2'], ['prompt-v3','rubric-v2','score-v2'], ['prompt-v4','rubric-v2','score-v2'], ['prompt-v5','rubric-v2','score-v2'], ['prompt-luna-v1','rubric-v2','score-v2'], ['prompt-luna-v2','rubric-v2','score-v2'], ['prompt-luna56-v1','rubric-v2','score-v2'], ['prompt-luna56-v2','rubric-v2','score-v2']];
export const v2LevelValues = [0,10,25,45,65,82,100];
export const load = path => JSON.parse(readFileSync(path, 'utf8'));
export function save(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(temp, path);
}
export function score(ratings, scoringVersion = 'score-v1') {
  if (!['score-v1','score-v2'].includes(scoringVersion)) throw Error('Unsupported scoring version');
  const keys = rubricAxes[scoringVersion === 'score-v1' ? 'rubric-v1' : 'rubric-v2'];
  const max = scoringVersion === 'score-v1' ? 4 : 6;
  if (!ratings || Object.keys(ratings).length !== keys.length || keys.some(k => !Number.isInteger(ratings[k]) || ratings[k] < 0 || ratings[k] > max)) throw Error(`ratings must contain exactly ${keys.length} integer levels 0-${max}`);
  if (scoringVersion === 'score-v1') {
    const value = (ratings.subject_match * 50 + ratings.structure * 30 + ratings.completion * 20) / 4;
    return ratings.subject_match === 0 ? Math.min(25, value) : value;
  }
  const weighted = keys.reduce((sum,k,i) => sum + v2LevelValues[ratings[k]] * [40,25,20,15][i], 0) / 100;
  const caps = [15,35,55,100,100,100,100];
  return Math.round(Math.min(caps[ratings.subject_match], weighted) * 100) / 100;
}

function string(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) throw Error(`Invalid ${field}`);
}
export function importEvaluations(db, entries) {
  if (!Array.isArray(entries) || !entries.length) throw Error('Expected non-empty evaluation array');
  const ids = new Set(db.evaluations.map(e => e.id));
  const validated = entries.map(e => {
    for (const key of ['id','drawing_id','model','model_version','reasoning_effort','execution_source','prompt_version','rubric_version','scoring_version','run_id','created_at']) string(e[key], key);
    const drawing = db.drawings.find(d => d.id === e.drawing_id);
    if (!drawing || drawing.image_sha256 !== e.image_sha256) throw Error('Unknown drawing or mismatched image hash');
    if (ids.has(e.id)) throw Error(`Duplicate evaluation ID: ${e.id}`);
    ids.add(e.id);
    if (!versionTriplets.some(([prompt,rubric,scoring]) => e.prompt_version === prompt && e.rubric_version === rubric && e.scoring_version === scoring)) throw Error('Unsupported version; add a versioned validator/scorer first');
    if (!['reference','candidate','human-correction'].includes(e.evaluator_type)) throw Error('Invalid evaluator_type');
    const dedicatedModel = e.prompt_version.startsWith('prompt-luna56-') ? 'gpt-5.6-luna' : e.prompt_version.startsWith('prompt-luna-') ? 'gpt-6-luna' : null;
    if (dedicatedModel && (e.evaluator_type !== 'candidate' || e.model !== dedicatedModel || e.reasoning_effort !== 'low' || e.execution_source !== 'codex-subscription')) throw Error('Dedicated Luna prompt requires its configured candidate model and low subscription provenance');
    if (e.evaluator_type === 'reference' && (e.model !== 'gpt-6.1-sol' || e.reasoning_effort !== 'low' || e.execution_source !== 'codex-subscription')) throw Error('Reference requires actual Sol low subscription provenance');
    if (!['low','medium','high'].includes(e.confidence) || !Number.isFinite(Date.parse(e.created_at))) throw Error('Invalid confidence/date');
    for (const key of ['visual_observations','positive_points','improvement_points']) {
      if (!Array.isArray(e[key]) || e[key].length > 3 || e[key].some(v => typeof v !== 'string' || !v.trim() || v.length > 120)) throw Error(`Invalid ${key}`);
    }
    const calculated_score = score(e.ratings, e.scoring_version);
    if (e.rubric_version === 'rubric-v2') {
      const keys = rubricAxes[e.rubric_version];
      if (!e.axis_evidence || Object.keys(e.axis_evidence).length !== keys.length) throw Error('v2 requires evidence for exactly four axes');
      for (const key of keys) {
        const evidence = e.axis_evidence[key];
        if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 2 || evidence.some(v => typeof v !== 'string' || !v.trim() || v.length > 120)) throw Error(`Invalid axis evidence: ${key}`);
        if (e.ratings[key] === 6 && new Set(evidence.map(v => v.trim())).size !== 2) throw Error(`Level 6 requires two distinct visible evidence points: ${key}`);
      }
    }
    return {...e, calculated_score};
  });
  return {...db, evaluations: [...db.evaluations, ...validated]};
}
export function review(db, entry) {
  if (!db.evaluations.some(e => e.id === entry.evaluation_id)) throw Error('Unknown evaluation');
  if (!['valid','check','inappropriate'].includes(entry.status) || typeof entry.note !== 'string' || entry.note.length > 2000) throw Error('Invalid review');
  return {...db, reviews: [...db.reviews, {id: randomUUID(), evaluation_id: entry.evaluation_id, status: entry.status, note: entry.note, reviewed_at: new Date().toISOString()}]};
}
export function latestReview(db, id) { return db.reviews.filter(r => r.evaluation_id === id).at(-1); }
export const groupKey = e => JSON.stringify([e.evaluator_type,e.model,e.model_version,e.reasoning_effort,e.prompt_version,e.rubric_version,e.scoring_version,e.run_id]);
const mean = a => a.reduce((s,v) => s+v,0)/a.length;
function ranks(values) { return values.map(v => 1 + values.filter(x => x < v).length + (values.filter(x => x === v).length-1)/2); }
export function spearman(a,b) {
  if (a.length < 2) return null;
  const x=ranks(a), y=ranks(b), mx=mean(x), my=mean(y);
  const den=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)*y.reduce((s,v)=>s+(v-my)**2,0));
  return den ? x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/den : null;
}
export function summary(db, acceptedOnly=false) {
  const groups = {};
  for (const e of db.evaluations) {
    if (acceptedOnly && latestReview(db,e.id)?.status !== 'valid') continue;
    const key=groupKey(e); (groups[key]??=[]).push(e);
  }
  const result = Object.entries(groups).map(([key, es]) => {
    const byDrawing={}; for (const e of es) (byDrawing[e.drawing_id]??=[]).push(e);
    const works=Object.entries(byDrawing).map(([drawing_id,runs])=>{
      const values=runs.map(e=>e.calculated_score), avg=mean(values);
      return {drawing_id,mean:avg,repeats:runs.length,variance:mean(values.map(v=>(v-avg)**2)),max_gap:Math.max(...values)-Math.min(...values),rubric_pair_agreement: (rubricAxes[es[0].rubric_version] || axes).map(axis=>{
        let pairs=0, same=0;for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){if(!Number.isInteger(runs[i].ratings?.[axis])||!Number.isInteger(runs[j].ratings?.[axis]))continue;pairs++;if(runs[i].ratings[axis]===runs[j].ratings[axis])same++;}
        return {axis,agreement:pairs?same/pairs:null};
      })};
    });
    const scores=works.map(w=>w.mean); let pairs=0,ties=0;
    for(let i=0;i<scores.length;i++)for(let j=i+1;j<scores.length;j++){pairs++;if(scores[i]===scores[j])ties++;}
    return {key,evaluations:es.length,histogram:Object.fromEntries(Array.from({length:10},(_,i)=>[`${i*10}–${(i+1)*10}${i===9?' (inclusive)':' (exclusive)'}`,scores.filter(s=>s>=i*10&&(i===9?s<=100:s<(i+1)*10)).length])),works,mean:mean(scores),min:Math.min(...scores),max:Math.max(...scores),tie_pair_rate:pairs?ties/pairs:null};
  });
  const comparisons=[];
  for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++){
    const common=result[i].works.filter(w=>result[j].works.some(v=>v.drawing_id===w.drawing_id));
    const a=common.map(w=>w.mean),b=common.map(w=>result[j].works.find(v=>v.drawing_id===w.drawing_id).mean);
    comparisons.push({a:result[i].key,b:result[j].key,n:common.length,spearman:spearman(a,b),mean_absolute_difference:common.length?mean(a.map((v,k)=>Math.abs(v-b[k]))):null});
  }
  return {acceptedOnly,groups:result,comparisons};
}
