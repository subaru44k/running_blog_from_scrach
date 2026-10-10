import {test} from 'node:test';
import assert from 'node:assert/strict';
import {score,importEvaluations,summary,rubricAxes} from './core.mjs';
import {reviewPriority} from './priority.mjs';
const keys=rubricAxes['rubric-v2'];
const ratings=values=>Object.fromEntries(keys.map((k,i)=>[k,values[i]]));
const e=(id='v2')=>({id,drawing_id:'d',image_sha256:'hash',evaluator_type:'reference',model:'gpt-6.1-sol',model_version:'snapshot unavailable',reasoning_effort:'low',execution_source:'codex-subscription',prompt_version:'prompt-v2',rubric_version:'rubric-v2',scoring_version:'score-v2',run_id:'test',ratings:ratings([3,3,3,3]),axis_evidence:Object.fromEntries(keys.map(k=>[k,['可視的な根拠']])),confidence:'medium',visual_observations:[],positive_points:[],improvement_points:[],created_at:'2026-10-05T00:00:00Z'});
const db=()=>({drawings:[{id:'d',image_sha256:'hash'}],evaluations:[],reviews:[]});
test('all 2401 v2 combinations are deterministic, bounded and monotonic; ordinary levels and subject caps hold',()=>{
 const values=new Set();
 for(let a=0;a<7;a++)for(let b=0;b<7;b++)for(let c=0;c<7;c++)for(let d=0;d<7;d++){
  const r=ratings([a,b,c,d]),v=score(r,'score-v2');values.add(v);assert.equal(v,score(r,'score-v2'));assert.ok(v>=0&&v<=100);if(a<3)assert.ok(v<=[15,35,55][a]);
  for(const k of keys)if(r[k]<6)assert.ok(score({...r,[k]:r[k]+1},'score-v2')>=v);
 }
 assert.ok(values.size>100);assert.equal(score(ratings([3,3,3,3]),'score-v2'),45);assert.equal(score(ratings([4,4,4,4]),'score-v2'),65);assert.equal(score(ratings([6,6,6,6]),'score-v2'),100);assert.equal(score(ratings([0,0,0,0]),'score-v2'),0);
});
test('version triplets and two distinct visible evidence points guard highest level; old entries survive',()=>{
 const base=db(),entry=e();const imported=importEvaluations(base,[entry]);assert.equal(imported.evaluations[0].calculated_score,45);
 assert.throws(()=>importEvaluations(base,[{...entry,prompt_version:'prompt-v1'}]));assert.throws(()=>importEvaluations(base,[{...entry,ratings:ratings([6,3,3,3])}]));assert.throws(()=>importEvaluations(base,[{...entry,axis_evidence:{}}]));
 const high={...entry,ratings:ratings([6,3,3,3]),axis_evidence:{...entry.axis_evidence,subject_match:['固有の輪郭が明瞭','内部特徴も対象と一貫している']}};
 const repeat=importEvaluations(imported,[{...high,id:'repeat'}]);assert.equal(repeat.evaluations[0].calculated_score,45);assert.equal(summary(repeat).groups[0].works[0].rubric_pair_agreement.length,4);
 assert.throws(()=>importEvaluations(base,[{...high,axis_evidence:{...high.axis_evidence,subject_match:['同じ根拠','同じ根拠']}}]));
});
test('old human concerns prioritize v2 but never transfer human judgment',()=>{
 const entry=e();assert.equal(reviewPriority(entry,null,null,{status:'inappropriate'}).length,1);assert.equal(reviewPriority(entry,null,{status:'valid'},{status:'inappropriate'}).length,0);assert.equal(reviewPriority(entry,null,null,{status:'valid'}).length,0);
});
test('prompt-only experiment retains v2 axis/scoring rules and separates condition statistics',()=>{
 const original=e('old-prompt'),changed={...e('new-prompt'),prompt_version:'prompt-v3',run_id:'prompt3-experiment'};
 const data=importEvaluations(db(),[original,changed]);assert.equal(data.evaluations[0].calculated_score,data.evaluations[1].calculated_score);assert.deepEqual(data.evaluations[0].ratings,data.evaluations[1].ratings);assert.equal(summary(data).groups.length,2);
 for(const version of ['prompt-v4','prompt-v5','prompt-luna-v1','prompt-luna-v2','prompt-luna56-v1','prompt-luna56-v2']){
  const entry={...changed,prompt_version:version,...(version.startsWith('prompt-luna')?{evaluator_type:'candidate',model:version.startsWith('prompt-luna56')?'gpt-5.6-luna':'gpt-6-luna'}:{})};
  const candidate=importEvaluations(db(),[entry]);assert.equal(candidate.evaluations[0].calculated_score,data.evaluations[1].calculated_score);assert.throws(()=>importEvaluations(db(),[{...entry,scoring_version:'score-v1'}]));
  if(version.startsWith('prompt-luna')){assert.throws(()=>importEvaluations(db(),[{...entry,evaluator_type:'reference'}]));assert.throws(()=>importEvaluations(db(),[{...entry,model:'wrong-model'}]));}
 }
 assert.throws(()=>importEvaluations(db(),[{...changed,prompt_version:'prompt-v6'}]));
});
test('Luna candidates remain separate model groups and cannot impersonate Sol reference',()=>{
 const sol={...e('sol'),prompt_version:'prompt-v3',run_id:'pilot'};
 const l56={...sol,id:'l56',evaluator_type:'candidate',model:'gpt-5.6-luna',reasoning_effort:'low'};
 const l6={...l56,id:'l6',model:'gpt-6-luna'};
 const data=importEvaluations(db(),[sol,l56,l6]);assert.equal(summary(data).groups.length,3);assert.equal(data.reviews.length,0);
 assert.throws(()=>importEvaluations(db(),[{...l56,evaluator_type:'reference'}]));
});
