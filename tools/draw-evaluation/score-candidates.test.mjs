import test from 'node:test';import assert from 'node:assert/strict';
import {candidates,candidateScore,axes,buildComparison} from './score-candidates.mjs';import {score} from './core.mjs';
test('all 2401 profiles: candidate scores deterministic, monotone, bounded, caps respected and baseline exact',()=>{
 for(let a=0;a<=6;a++)for(let b=0;b<=6;b++)for(let c=0;c<=6;c++)for(let d=0;d<=6;d++){
  const r=Object.fromEntries(axes.map((k,i)=>[k,[a,b,c,d][i]]));assert.equal(candidateScore(r,candidates[0]),score(r,'score-v2'));
  for(const candidate of candidates){const value=candidateScore(r,candidate);assert.equal(value,candidateScore({...r},candidate));assert.ok(value>=0&&value<=100);if(!candidate.anchors)assert.ok(value<=[15,35,55,100,100,100,100][a]);for(const k of axes)if(r[k]<6)assert.ok(candidateScore({...r,[k]:r[k]+1},candidate)>=value);}
 }
});
test('comparison ignores rejected versions and repeats as primary, keeps valid separate and never mutates records',()=>{
 const e=(id,drawing_id,ratings)=>({id,drawing_id,ratings,prompt_version:'prompt-v3',rubric_version:'rubric-v2',run_id:'reference-p3-20261005-01'});
 const r=Object.fromEntries(axes.map(k=>[k,3]));const db={drawings:['a','b'].map(id=>({id,prompt_text:id,image_path:`images/${id}.png`})),evaluations:[e('sol-ref-p3-01-a','a',r),e('sol-ref-p3-01-b','b',r),e('sol-ref-p3-02-a','a',r),{...e('rejected','a',r),prompt_version:'prompt-v5'}],reviews:[{evaluation_id:'sol-ref-p3-01-a',status:'valid'},{evaluation_id:'sol-ref-p3-01-b',status:'check'}]};const snapshot=structuredClone(db),report=buildComparison(db);assert.deepEqual(db,snapshot);assert.equal(report.counts.all,2);assert.equal(report.counts.valid,1);assert.equal(report.unavoidable_identical_pairs,1);for(const c of candidates)assert.equal(report.metrics.all[c.id].tied_pairs,1);
});

test('game calibration has fixed anchors, zero remains zero, all-four below 80 and all-five reaches 95',()=>{
 const c=candidates.find(c=>c.id==='game-balanced');for(const [level,expected] of [[0,0],[3,70],[4,79],[5,95],[6,100]])assert.equal(candidateScore(Object.fromEntries(axes.map(k=>[k,level])),c),expected);
 for(let a=0;a<=4;a++)for(let b=0;b<=4;b++)for(let d=0;d<=4;d++)for(let e=0;e<=4;e++)assert.ok(candidateScore(Object.fromEntries(axes.map((k,i)=>[k,[a,b,d,e][i]])),c)<80);
});
