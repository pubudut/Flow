import {pendingReviews} from './migration-report.js';
import {isApproved} from './generator.js';
import {translationReport} from './translator.js';

// Vector PDF: explicit page breaks and measured text keep large repositories legible.
export function createMigrationPdf(snapshot,approval,JsPDF){
 const {files,report,plan,notes}=JSON.parse(snapshot);
 const isIdea=report?.kind==='idea';
 if(!plan||!report)throw Error('Create an architecture proposal first.');
 if(pendingReviews(plan).length)throw Error('Complete the evidence-backed design reviews before generating the PDF.');
 const doc=new JsPDF({unit:'mm',format:'a4'}),W=210,H=297,M=19;
 const blue='#335CDE',navy='#13213D',muted='#596780';let y=25;
 const text=value=>String(value??'').replace(/[→]/g,' -> ').replace(/[·]/g,' | ').replace(/[—–−]/g,'-').replace(/[^\x20-\x7E\n]/g,'?');
 function page(title){doc.addPage();y=25;heading(title);}
 function ensure(height){if(y+height>275){doc.addPage();y=25;}}
 function heading(value,size=20){ensure(20);doc.setFont('helvetica','bold');doc.setFontSize(size);doc.setTextColor(navy);const lines=doc.splitTextToSize(text(value),W-2*M);doc.text(lines,M,y);y+=lines.length*size*.42+7;}
 function paragraph(value,size=10,color=muted){doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(color);for(const line of doc.splitTextToSize(text(value),W-2*M)){ensure(6);doc.text(line,M,y);y+=5;}y+=3;}
 function bullets(values){for(const value of values||[])paragraph('- '+value);}
 function box(x,top,width,label,detail,accent=blue){
  const short=(s,n)=>s.length>n?s.slice(0,n-3)+'...':s;
  doc.setFont('helvetica','bold');doc.setFontSize(10);const title=doc.splitTextToSize(short(text(label),120),width-10);
  doc.setFont('helvetica','normal');doc.setFontSize(8);const body=doc.splitTextToSize(short(text(detail),420),width-10);
  const height=12+title.length*4.5+body.length*3.8;
  doc.setFillColor('#F3F6FD');doc.setDrawColor('#D9E1F1');doc.roundedRect(x,top,width,height,2,2,'FD');doc.setFillColor(accent);doc.rect(x,top,1.3,height,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(navy);doc.text(title,x+5,top+7);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(muted);doc.text(body,x+5,top+9+title.length*4.5);return height;
 }
 function arrow(x,from,to,label){doc.setDrawColor(blue);doc.setLineWidth(.5);doc.line(x,from,x,to);doc.line(x,to,x-1.5,to-2);doc.line(x,to,x+1.5,to-2);if(label){doc.setFontSize(7);doc.setTextColor(muted);doc.text(text(label),x+3,(from+to)/2+1);}}
 function stack(label,detail,connector){const height=box(M,y,W-2*M,label,detail);y+=height;if(connector){arrow(W/2,y,y+13,connector);y+=17;}else y+=8;}
 const coverage=translationReport(files,report);
 doc.setFillColor(navy);doc.rect(0,0,W,100,'F');doc.setFillColor(blue);doc.rect(M,23,20,2,'F');
 doc.setTextColor('#B6C6FA');doc.setFontSize(10);doc.text('FLOW / MIGRATION INTELLIGENCE',M,17);
 doc.setFont('helvetica','bold');doc.setFontSize(30);doc.setTextColor('#FFFFFF');doc.text(isIdea?['New system design','Architecture &','design assessment']:['Legacy modernization','Architecture &','migration assessment'],M,43);
 y=118;heading(isApproved(snapshot,approval)?'Approved architecture snapshot':'Reviewed design proposal',18);
 paragraph('Generated '+new Date().toISOString());paragraph(isIdea?report.name+' / '+report.requirements.length+' requirements / '+plan.modules.length+' capabilities':files.length+' source files / '+report.programs.length+' COBOL programs / '+report.flows.length+' business flows',12,navy);
 paragraph(plan.style,14,blue);paragraph(plan.rationale);
 paragraph(isIdea?'Document scope: requirement context, proposed capabilities, Spring Boot component diagrams, SOLID, object-oriented design, SOA, anti-patterns, design patterns and distributed-system assessments.':'Document scope: current architecture, proposed capability and Spring Boot component diagrams, design applicability decisions, source evidence, business behavior and migration readiness.');
 paragraph('Observed dependencies are static evidence. Proposed components express engineering intent; they do not imply that persistence, domain models or distributed workflows have already been generated.');
 paragraph('Review status: '+plan.assessment.findings.filter(f=>f.automatic).length+' aspects automatically marked Not applicable because no supporting '+(isIdea?'requirement':'source evidence')+' was found.');
 if(isApproved(snapshot,approval)){paragraph('Approved '+approval.approvedAt);paragraph('Snapshot SHA-256: '+approval.sha256,8);}
 page(isIdea?'01 / System context and requirements':'01 / Current architecture');paragraph(isIdea?'A new system has no legacy architecture. The following context is a proposal based on supplied requirements, not an observed implementation.':'One source-centered view per program keeps dependencies readable. Arrows show observed calls, data access and copybook dependencies, not inferred runtime ordering.');
 if(isIdea){stack('Users and external callers','Actors and access rights must be validated from the requirements.','use');stack(report.name,report.idea,'collaborates with');stack('External dependencies',plan.integration.join('; ')||'No external dependency requirement supplied.');}
 else if(!report.programs.length)paragraph('No COBOL program boundaries identified.');
 for(const [i,p] of report.programs.entries()){
  if(i)page('Current architecture / '+p.name);
  heading(p.name,15);paragraph(p.file,9);stack('COBOL program: '+p.name,'Observed legacy boundary','depends on');
  const deps=[...p.calls.map(c=>({name:c.value,detail:c.kind+' | '+c.ref})),...p.data.map(d=>({name:d.value,detail:'Data access: '+d.kind+' | '+d.ref})),...p.copies.map(c=>({name:c.value,detail:'Copybook | '+c.ref}))];
  if(!deps.length)stack('No dependencies identified','Confirm linkage inputs, job scheduling and external platform dependencies.');
  for(const d of deps){ensure(65);const ht=box(M+8,y,W-2*M-16,d.name,d.detail,'#7A56C4');doc.setDrawColor(blue);doc.line(M+3,y-5,M+3,y+ht/2);doc.line(M+3,y+ht/2,M+8,y+ht/2);y+=ht+5;}
  paragraph('Dependency cards above are a fan-out from '+p.name+'. Repeated resources can indicate shared ownership.');
  heading('Transaction evidence',13);bullets(p.transactions.map(t=>t.value+' | '+t.ref));
 }
 page('02 / Proposed capability architecture');paragraph(plan.style+'. Proposed boundaries reflect the reviewed capability names and ownership. Adapters below are design requirements, not generated implementations.');
 for(const [i,m] of plan.modules.entries()){
  if(i)page('Proposed capability / '+m.name);
  stack(plan.style==='Candidate service boundaries'?'Spring Boot service boundary':'Spring Boot application boundary',plan.style==='Candidate service boundaries'?'Independent service candidate; validate transaction coupling before separation.':'One deployment with internal capability modules.','contains');
  stack(m.name,m.responsibility,'delegates infrastructure to');
  stack('Ports and adapters',m.adapters.length?m.adapters.join('; '):'No infrastructure adapter identified from source. Add only when requirements justify it.');
  heading(isIdea?'Capability rationale':'Legacy ownership',13);if(!isIdea)bullets(m.sources||[m.source]);paragraph(m.reason);
 }
 page('03 / Spring Boot component design');paragraph('Solid connectors describe a proposed request path. These are logical layers, not a recommendation to deploy every layer as a service.');
 stack('Clients / batch callers',isIdea?'Proposed capability commands and queries; define actors and authorization.':'HTTP request with rule identifier and decimal fields','HTTP / JSON');
 stack(isIdea?'API layer - capability controllers':'API layer - RuleController',isIdea?'Proposed REST contracts, request validation, authorization and error responses.':'Generated POST /api/rules/evaluate; define validation and error contracts.','invokes');
 stack('Application layer - use-case services','Proposed capability orchestration and transaction boundaries. Requires domain implementation.','coordinates');
 stack('Domain layer - capability policies',isIdea?'Proposed aggregates, immutable value objects and policies. Define invariants and lifecycle transitions before implementation.':'Generated RuleEngine preserves supported numeric calculations. Rich domain entities, invariants and strategies require further design.','through ports');
 stack('Infrastructure layer - adapters','Proposed persistence, external-system and messaging adapters based on observed dependencies. Not generated automatically.');
 paragraph(isIdea?'Proposed operational foundation: Actuator health probes, authorization, tracing and metrics. Establish SLOs, resilience budgets, delivery and recovery tests. No application code has been generated.':'Operational foundation: generated Actuator health endpoint. Security, observability, resilience, deployment and scaling policies require implementation and validation.',9);
 page('04 / Design applicability decisions');
 for(const f of plan.assessment.findings){
  const evidence=f.evidence.length?f.evidence:['No supporting '+(isIdea?'requirement':'source evidence')+' found. Operational requirements may change this conclusion.'];
  doc.setFont('helvetica','normal');doc.setFontSize(10);
  const fields=[f.category+' / '+f.decision+(f.automatic?' / automatic, no supporting evidence':' / reviewer disposition'),f.notes||'No additional rationale recorded.','Recommendation: '+f.action,...(f.when?['Applicability: '+f.when]:[]),'Trade-off: '+f.tradeoff,'Evidence:',...evidence.map(e=>'- '+e)];
  const height=22+fields.reduce((sum,t)=>sum+doc.splitTextToSize(text(t),W-2*M).length*5+3,0);
  ensure(Math.min(height,245));heading(f.title,14);paragraph(fields[0],9,blue);paragraph(fields[1]);paragraph('Recommendation: '+f.action);if(f.when)paragraph('Applicability: '+f.when);paragraph('Trade-off: '+f.tradeoff);paragraph('Evidence:',9,navy);bullets(evidence);
 }
 page('05 / Business behavior and traceability');
 if(plan.ai){heading('AI interpretation / '+plan.ai.model,14);for(const rule of report.aiBusinessRules||[]){ensure(35);heading(rule.name,12);paragraph(rule.description);bullets(rule.evidence);}paragraph('AI interpretations require business-owner and source validation. No runtime equivalence has been established.');}
 if(isIdea)bullets(report.requirements.map(r=>r.ref+' - '+r.value));
 for(const f of report.flows){ensure(35);heading(f.name,14);paragraph(f.file+(f.uncertain?' / partial control-flow analysis':''));bullets(f.nodes.map(n=>n.label+' | '+n.ref));}
 page(isIdea?'06 / Implementation readiness':'06 / Migration readiness');paragraph(isIdea?'Design proposal only. Business implementation, API contracts and acceptance tests remain to be developed.':coverage.supported.length+' executable flows / '+coverage.blocked.length+' blocked flows',13,navy);
 if(!isIdea){heading('Translation blockers',14);bullets(coverage.blocked.length?coverage.blocked.map(r=>r.id+' - '+r.reason):['No blockers in the supported numeric translation scope.']);}
 heading('Architecture decisions',14);bullets(plan.decisions);heading('Integration and coupling',14);bullets([...plan.integration,...plan.coupling]);
 heading('Analysis gaps and limits',14);bullets([...new Set([...plan.gaps,...plan.assessment.limits])]);
 heading('Delivery and validation plan',14);bullets(isIdea?['Write acceptance examples and domain invariants for each capability.','Define authorization, privacy, API and integration contracts.','Implement one vertical use case and its ports and adapters.','Test correctness, concurrency, load, failure recovery and observability.','Release incrementally with measurable outcomes and rollback criteria.']:['Capture representative legacy inputs, outputs, side effects and transaction boundaries.','Validate domain ownership and invariants with business owners.','Implement unresolved adapters and unsupported syntax; compare behavior with legacy execution.','Test numeric boundaries, rounding, errors, concurrency, recovery and load.','Release gradually with traffic comparison and rollback criteria.']);
 heading('Review notes',14);paragraph(notes||'None recorded.');
 const count=doc.getNumberOfPages();for(let i=1;i<=count;i++){doc.setPage(i);doc.setDrawColor('#D9E1F1');doc.line(M,282,W-M,282);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(muted);doc.text('FLOW / LOCAL MIGRATION ASSESSMENT',M,288);doc.text(i+' / '+count,W-M,288,{align:'right'});}
 return doc;
}
