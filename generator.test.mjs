import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,architecture,sample} from './analyzer.js';
import {reviewSnapshot,approveSnapshot,generateProject,zipFiles} from './generator.js';
test('approval required and changes invalidate generation',async()=>{
 const report=analyze(sample),plan=architecture(report,'modular');
 const snapshot=reviewSnapshot(sample,report,plan,'Reviewed');
 assert.throws(()=>generateProject(snapshot,null),/Approve/);
 const receipt=await approveSnapshot(snapshot);
 const files=generateProject(snapshot,receipt);
 assert.ok(files['application/pom.xml']);
 assert.ok(files['application/src/main/java/local/migration/module1/BusinessOperation.java']);
 for(const changed of [
  reviewSnapshot(sample,report,plan,'Changed'),
  reviewSnapshot(sample,report,architecture(report,'independent'),'Reviewed'),
  reviewSnapshot([],report,plan,'Reviewed')
 ])assert.throws(()=>generateProject(changed,receipt),/Approve/);
 const archive=new Uint8Array(await zipFiles(files).arrayBuffer());
 assert.deepEqual([...archive.slice(0,4)],[80,75,3,4]);
});
test('independent service proposals generate separate projects',async()=>{
 const report=analyze(sample),plan=architecture(report,'independent');
 plan.modules.push({name:'SECOND',source:'other.cbl'});
 const snapshot=reviewSnapshot(sample,report,plan,'Reviewed');
 const files=generateProject(snapshot,await approveSnapshot(snapshot));
 assert.ok(files['service-1/pom.xml']);assert.ok(files['service-2/pom.xml']);
});
