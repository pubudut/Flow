import test from 'node:test';
import assert from 'node:assert/strict';
import {sample,analyze,architecture} from './analyzer.js';
import {translationReport} from './translator.js';
import {reviewSnapshot,approveSnapshot,generateProject} from './generator.js';
test('numeric compiler supports nested branches and rounding',()=>{
 const result=translationReport(sample,analyze(sample));
 assert.equal(result.blocked.length,0);
 assert.deepEqual(result.supported[0].inputs,['ORDER-TOTAL','CUSTOMER-YEARS']);
 assert.match(result.supported[0].code,/RoundingMode.HALF_UP/);
 assert.match(result.supported[0].code,/else/);
});
test('unsupported numeric semantics block generation after approval',async()=>{
 for(const replacement of ['ORDER-TOTAL / 3','UNKNOWN-FIELD','ORDER-TOTAL ** 2']){
  const files=sample.map(f=>({...f,text:f.text.replace('ORDER-TOTAL * 0.10',replacement)}));
  const report=analyze(files),snapshot=reviewSnapshot(files,report,architecture(report,'modular'),'reviewed');
  assert.throws(()=>generateProject(snapshot,null),/Approve/);
  const approval=await approveSnapshot(snapshot);
  assert.throws(()=>generateProject(snapshot,approval),/unsupported/i);
 }
});
