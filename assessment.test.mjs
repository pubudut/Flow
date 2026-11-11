import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,architecture,sample} from './analyzer.js';
import {reviewSnapshot,approveSnapshot,isApproved,generateProject} from './generator.js';
test('all requested distributed principles have applicability and tradeoffs',()=>{
 const findings=architecture(analyze(sample),'modular').assessment.findings;
 const expected=['Consistency','Consensus','Quorum','Leader election','Replication','Partitioning','Sharding','Backpressure','Retries','Idempotency','Ordering','Distributed transactions','Saga','Outbox','CQRS','Event sourcing','Exactly-once semantics','At-least-once delivery','Circuit breakers','Bulkheads','Rate limiting'];
 for(const title of expected){
  const item=findings.find(f=>f.title===title);
  assert.ok(item?.when&&item.tradeoff&&item.action,title);
  assert.equal(item.status,'Needs validation');
 }
 assert.equal(findings.filter(f=>f.category==='SOLID').length,5);
});
test('review decisions and capability changes invalidate approval',async()=>{
 const report=analyze(sample),plan=architecture(report,'modular');
 const snapshot=reviewSnapshot(sample,report,plan,'');
 const receipt=await approveSnapshot(snapshot);
 plan.assessment.findings[0].decision='Investigate';
 assert.equal(isApproved(reviewSnapshot(sample,report,plan,''),receipt),false);
});
test('merged capability includes rules from all its source programs',async()=>{
 const files=[...sample,{...sample[0],name:'other.cbl',text:sample[0].text.replace('ORDER-PRICE','SECOND')}];
 const report=analyze(files),plan=architecture(report,'independent');
 plan.modules=[{...plan.modules[0],sources:files.map(f=>f.name)}];
 const snapshot=reviewSnapshot(files,report,plan,'');
 const generated=generateProject(snapshot,await approveSnapshot(snapshot));
 const contracts=JSON.parse(generated['service-1/rule-contracts.json']);
 assert.equal(contracts.length,2);
 assert.ok(!generated['service-2/pom.xml']);
});
test('scope terminators do not become bogus paragraphs',()=>{
 const report=analyze([{name:'scope.cbl',text:'PROCEDURE DIVISION.\nMAIN SECTION.\nIF X = 1\nMOVE 1 TO Y\nEND-IF.\nGOBACK.'}],'free');
 assert.equal(report.flows.length,1);
 assert.equal(report.flows[0].name,'MAIN SECTION');
});
