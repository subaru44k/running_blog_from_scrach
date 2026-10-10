import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {score,importEvaluations,review,summary,spearman,save,load} from './core.mjs';
const db=()=>({drawings:[{id:'d',image_sha256:'abc'}],evaluations:[],reviews:[]});
const evaluation=(id='e')=>({id,drawing_id:'d',image_sha256:'abc',evaluator_type:'candidate',model:'test-fixture',model_version:'fixture',reasoning_effort:'low',execution_source:'fixture',prompt_version:'prompt-v1',rubric_version:'rubric-v1',scoring_version:'score-v1',run_id:'test',ratings:{subject_match:3,structure:2,completion:4},confidence:'medium',visual_observations:[],positive_points:[],improvement_points:[],created_at:'2026-10-05T00:00:00Z'});
test('125 rubric combinations are bounded, deterministic, monotonic, with off-topic cap',()=>{
 for(let a=0;a<5;a++)for(let b=0;b<5;b++)for(let c=0;c<5;c++){
  const ratings={subject_match:a,structure:b,completion:c},v=score(ratings);assert.ok(v>=0&&v<=100);assert.equal(v,score(ratings));if(a===0)assert.ok(v<=25);
  for(const k of Object.keys(ratings))if(ratings[k]<4)assert.ok(score({...ratings,[k]:ratings[k]+1})>=v);
 }
 assert.equal(score({subject_match:4,structure:4,completion:4}),100);
 assert.equal(score({subject_match:0,structure:0,completion:0}),0);
 assert.throws(()=>score({subject_match:1.5,structure:0,completion:0}));
});
test('import recomputes score, retains repeat history, rejects duplicates atomically and validates provenance',()=>{
 const original=db(),e=evaluation();e.calculated_score=100;
 const imported=importEvaluations(original,[e,evaluation('e2')]);assert.equal(imported.evaluations[0].calculated_score,72.5);assert.equal(imported.evaluations.length,2);assert.equal(original.evaluations.length,0);
 assert.throws(()=>importEvaluations(original,[e,e]));assert.throws(()=>importEvaluations(original,[{...e,image_sha256:'wrong'}]));assert.throws(()=>importEvaluations(original,[{...e,evaluator_type:'reference'}]));assert.throws(()=>importEvaluations(original,[{...e,scoring_version:'missing'}]));
});
test('review history survives disk reload and latest status controls accepted-only statistics',()=>{
 const dir=mkdtempSync(join(tmpdir(),'draw-eval-'));try{
 const path=join(dir,'dataset.json');let data=importEvaluations(db(),[evaluation()]);
 data=review(data,{evaluation_id:'e',status:'valid',note:'確認'});save(path,data);assert.equal(load(path).reviews[0].note,'確認');assert.equal(summary(load(path),true).groups.length,1);
 data=review(load(path),{evaluation_id:'e',status:'inappropriate',note:'除外'});save(path,data);assert.equal(load(path).reviews.length,2);assert.equal(summary(load(path),true).groups.length,0);
 assert.throws(()=>review(data,{evaluation_id:'absent',status:'valid',note:''}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('tie-aware ranks, constant groups and repeated-score dispersion',()=>{
 assert.equal(spearman([1,2,2],[1,3,3]),1);assert.equal(spearman([1,2,3],[3,2,1]),-1);assert.equal(spearman([1,1],[2,3]),null);
 const data=importEvaluations(db(),[evaluation(),{...evaluation('e2'),ratings:{subject_match:4,structure:4,completion:4}}]);const work=summary(data).groups[0].works[0];assert.equal(work.repeats,2);assert.equal(work.max_gap,27.5);assert.equal(work.mean,86.25);
});
