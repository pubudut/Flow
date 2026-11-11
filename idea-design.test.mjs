import test from 'node:test';
import assert from 'node:assert/strict';
import {designIdea,sampleIdea} from './idea-design.js';
import {reviewSnapshot,approveSnapshot,isApproved,generateProject} from './generator.js';
test('new-system design covers every requested category with real requirement references',()=>{
 const {report,plan}=designIdea(sampleIdea);
 assert.equal(report.kind,'idea');assert.equal(report.programs.length,0);assert.equal(plan.modules.length,5);
 const categories=new Set(plan.assessment.findings.map(f=>f.category));
 for(const category of ['SOLID','Object-oriented design','SOA','Anti-patterns','Design patterns','Distributed systems'])assert.ok(categories.has(category));
 assert.equal(plan.assessment.findings.filter(f=>f.category==='SOLID').length,5);
 assert.equal(plan.assessment.findings.filter(f=>f.category==='Distributed systems').length,21);
 for(const f of plan.assessment.findings){for(const evidence of f.evidence)assert.ok(report.requirements.some(r=>evidence===r.ref+' · '+r.value));if(!f.evidence.length){assert.equal(f.decision,'Not applicable');assert.equal(f.automatic,true);}}
 const plain=designIdea({...sampleIdea,idea:'Users maintain personal notes.',constraints:'',capabilities:'Notes'});
 assert.equal(plain.plan.assessment.findings.find(f=>f.title==='Saga').decision,'Not applicable');
 assert.equal(plain.plan.modules.length,1);
});
test('idea edits invalidate approval and cannot produce fake executable legacy code',async()=>{
 const {report,plan}=designIdea(sampleIdea),snapshot=reviewSnapshot([],report,plan,'Reviewed');
 const receipt=await approveSnapshot(snapshot);assert.ok(isApproved(snapshot,receipt));
 const changed=designIdea({...sampleIdea,constraints:'Strong consistency required.'});
 assert.equal(isApproved(reviewSnapshot([],changed.report,changed.plan,'Reviewed'),receipt),false);
 assert.throws(()=>generateProject(snapshot,receipt),/No approved flows/);
 assert.throws(()=>designIdea({...sampleIdea,idea:''}),/describe the idea/);
});
