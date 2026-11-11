import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {analyze,architecture,sample} from './analyzer.js';
import {reviewSnapshot} from './generator.js';
import {pendingReviews} from './migration-report.js';
import {createMigrationPdf} from './report-pdf.js';
import {designIdea,sampleIdea} from './idea-design.js';
const context={console,TextEncoder,TextDecoder,atob,btoa,setTimeout,clearTimeout};
runInNewContext(readFileSync('vendor/jspdf.js','utf8'),context);
test('new-system PDF includes requirement context without claiming generated code',()=>{
 const {report,plan}=designIdea(sampleIdea);
 plan.assessment.findings.filter(f=>f.evidence.length).forEach(f=>{f.decision='Accept recommendation';});
 const document=createMigrationPdf(reviewSnapshot([],report,plan,''),null,context.jspdf.jsPDF);
 const pdf=document.output();
 mkdirSync('tmp/pdfs',{recursive:true});writeFileSync('tmp/pdfs/new-system.pdf',Buffer.from(document.output('arraybuffer')));
 for(const label of ['New system design','System context and requirements','Spring Boot component design','REQ-001'])assert.ok(pdf.includes(label),label);
 assert.ok(!pdf.includes('Generated RuleEngine'));assert.ok(!pdf.includes('Generated POST'));
});
test('unsupported evidence automatically removes review burden; supported evidence remains open',()=>{
 const report=analyze(sample),plan=architecture(report,'modular');
 for(const f of plan.assessment.findings){
  if(!f.evidence.length){assert.equal(f.decision,'Not applicable');assert.equal(f.automatic,true);assert.ok(f.notes);}
  else assert.equal(f.decision,'Open');
 }
 assert.equal(pendingReviews(plan).length,plan.assessment.findings.filter(f=>f.evidence.length).length);
 assert.throws(()=>createMigrationPdf(reviewSnapshot(sample,report,plan,''),null,context.jspdf.jsPDF),/Complete/);
});
test('reviewed sample generates a vector PDF with all architecture views',()=>{
 const report=analyze(sample),plan=architecture(report,'modular');
 plan.assessment.findings.filter(f=>f.evidence.length).forEach(f=>{f.decision='Accept recommendation';f.notes='Sample report demonstration; validate with domain owners.';});
 const doc=createMigrationPdf(reviewSnapshot(sample,report,plan,'Sample demonstration report, not a production approval.'),null,context.jspdf.jsPDF);
 const pdf=doc.output();assert.ok(pdf.startsWith('%PDF-'));assert.ok(doc.getNumberOfPages()>6);
 for(const label of ['Current architecture','Proposed capability architecture','Spring Boot component design','RuleController','Migration readiness'])assert.ok(pdf.includes(label),label);
 mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/sample-migration-report.pdf',Buffer.from(doc.output('arraybuffer')));
});
