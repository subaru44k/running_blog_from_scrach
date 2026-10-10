import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewPriority} from './priority.mjs';
const e={evaluator_type:'reference',calculated_score:70,confidence:'medium'};
test('priority identifies score ceiling, uncertainty and exact 25-point boundary',()=>{
 assert.equal(reviewPriority(e,{calculated_score:45},null).length,1);
 assert.equal(reviewPriority(e,{calculated_score:45.5},null).length,0);
 assert.equal(reviewPriority({...e,calculated_score:100,confidence:'low'},{calculated_score:70},null).length,3);
 assert.equal(reviewPriority({...e,calculated_score:0},{calculated_score:26},null).length,1);
});
test('completed reviews leave queue regardless of status; no mutation or production prioritization',()=>{
 const evaluation={...e,confidence:'low'};const before=JSON.stringify(evaluation);
 for(const status of ['valid','check','inappropriate'])assert.deepEqual(reviewPriority(evaluation,null,{status}),[]);
 assert.deepEqual(reviewPriority({...evaluation,evaluator_type:'production-saved'},null,null),[]);
 assert.equal(JSON.stringify(evaluation),before);
});
