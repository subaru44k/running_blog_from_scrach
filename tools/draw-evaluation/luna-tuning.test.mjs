import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSplit,compare} from './luna-tuning.mjs';
const rating={subject_match:3,feature_capture:3,form_coherence:3,finish_quality:3};
test('holdout rejects duplicate IDs and duplicate images',()=>{
 assertSplit([{id:'a',image_sha256:'x'}],[{id:'b',image_sha256:'y'}]);
 assert.throws(()=>assertSplit([{id:'a',image_sha256:'x'}],[{id:'a',image_sha256:'y'}]));
 assert.throws(()=>assertSplit([{id:'a',image_sha256:'x'}],[{id:'b',image_sha256:'x'}]));
});
test('comparison pairs by ID and rejects missing or altered inputs',()=>{
 const a={drawing_id:'a',image_sha256:'x',ratings:rating};
 assert.equal(compare([a],[a]).ordinal_mae,0);
 assert.throws(()=>compare([a],[]));
 assert.throws(()=>compare([],[]));
 assert.throws(()=>compare([a,a],[a,{...a,drawing_id:'b'}]));
 assert.throws(()=>compare([a],[{...a,image_sha256:'other'}]));
 const b={...a,ratings:{...rating,finish_quality:4}};
 assert.equal(compare([a],[b]).ordinal_mae,.25);
});
