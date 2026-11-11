import {isApproved} from './generator.js';
import {translationReport} from './translator.js';
export function pendingReviews(plan){
 return (plan?.assessment?.findings||[]).filter(f=>!f.decision||f.decision==='Open'||(['Investigate','Defer with notes','Not applicable'].includes(f.decision)&&!f.notes?.trim()));
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=items=>items?.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>None identified by static analysis.</p>';
export function migrationReport(snapshot,approval){
 const {files,report,plan,notes}=JSON.parse(snapshot);
 if(!report||!plan)throw Error('Create an architecture proposal first.');
 if(pendingReviews(plan).length)throw Error('Review every design aspect and add rationale for Not applicable, Investigate and Defer with notes before generating the report.');
 const coverage=translationReport(files,report);
 return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Legacy migration analysis</title><style>
 body{font:16px/1.6 system-ui,sans-serif;color:#203835;background:#f4f7f7;margin:0}main{max-width:1050px;margin:32px auto;background:white;padding:48px}h1,h2,h3{line-height:1.25}h2{margin-top:42px;border-bottom:2px solid #178778;padding-bottom:12px}article{border:1px solid #ccdcd8;border-radius:10px;padding:20px;margin:16px 0;break-inside:avoid}p,li,td{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}th,td{text-align:left;border:1px solid #ccdcd8;padding:12px;vertical-align:top}small{color:#526a65}a{color:#087668}@media print{body{background:white}main{margin:0;padding:0}button{display:none}}</style><main>
 <h1>Legacy repository migration analysis</h1><p>Generated ${esc(new Date().toISOString())}</p>
 <p><strong>${isApproved(snapshot,approval)?'Architecture approved':'Design applicability reviewed — architecture approval pending'}</strong></p>
 ${isApproved(snapshot,approval)?'<p>Approval: '+esc(approval.approvedAt)+'<br>SHA-256: '+esc(approval.sha256)+'</p>':''}
 <p>${files.length} source files · ${report.programs.length} COBOL programs · ${report.flows.length} business flows</p>
 <p>This report describes static source evidence and reviewer decisions. Runtime behavior, business boundaries and operational requirements require validation. Applicability decisions do not automatically implement design patterns.</p>
 <h2>1. Current architecture</h2>
 ${report.programs.map(p=>`<article><h3>${esc(p.name)}</h3><p>Source: ${esc(p.file)}</p><h4>Program calls</h4>${list(p.calls.map(c=>c.value+' ('+c.kind+') · '+c.ref))}<h4>Data resources and copybooks</h4>${list([...p.data,...p.copies].map(d=>d.kind+': '+d.value+' · '+d.ref))}<h4>Transaction evidence</h4>${list(p.transactions.map(t=>t.value+' · '+t.ref))}</article>`).join('')}
 <h3>Integration and shared-resource coupling</h3>${list([...plan.integration,...plan.coupling])}
 <h2>2. Business flows</h2>${report.flows.map(f=>`<article><h3>${esc(f.name)}</h3><p>${esc(f.file)} · ${f.uncertain?'Partial — control flow needs validation':'Extracted flow'}</p>${list(f.nodes.map(n=>n.label+' · '+n.ref))}</article>`).join('')}
 <h2>3. Proposed architecture</h2><h3>${esc(plan.style)}</h3><p>${esc(plan.rationale)}</p>
 ${plan.modules.map(m=>`<article><h3>${esc(m.name)}</h3><p>${esc(m.responsibility)}</p><p>${esc(m.reason)}</p><h4>Legacy ownership</h4>${list(m.sources||[m.source])}<h4>Proposed adapters</h4>${list(m.adapters)}<p>${esc(m.validation)}</p></article>`).join('')}
 <h3>Architecture decisions</h3>${list(plan.decisions)}
 <h2>4. Reviewed design applicability</h2>
 ${plan.assessment.findings.map(f=>`<article><small>${esc(f.category)} · ${esc(f.status)}</small><h3>${esc(f.title)}</h3><p><strong>Reviewer disposition: ${esc(f.decision)}</strong></p><p>${esc(f.notes||'No additional rationale recorded.')}</p><p>${esc(f.action)}</p><p>${esc(f.when)}</p><p>Trade-off: ${esc(f.tradeoff)}</p><h4>Source evidence</h4>${list(f.evidence)}</article>`).join('')}
 <h2>5. Migration readiness and implementation scope</h2><p>${coverage.supported.length} executable flows · ${coverage.blocked.length} blocked flows.</p>
 <h3>Supported behavior</h3>${list(coverage.supported.map(r=>r.id+' — inputs: '+r.inputs.join(', ')+'; outputs: '+r.outputs.join(', ')))}
 <h3>Translation blockers</h3>${list(coverage.blocked.map(r=>r.id+' — '+r.reason))}
 <h3>Analysis gaps and limitations</h3>${list([...new Set([...plan.gaps,...plan.assessment.limits])])}
 <h3>Migration validation plan</h3>${list(['Capture legacy input/output cases and side effects before changing behavior.','Validate capability ownership, invariants and transaction boundaries with domain owners.','Implement unresolved persistence and integration adapters; resolve unsupported COBOL semantics.','Compare generated behavior with legacy characterization tests, including boundary values and rounding.','Validate throughput, latency, recovery and observability; migrate traffic gradually with rollback.'])}
 <h3>Architecture review notes</h3><p style="white-space:pre-wrap">${esc(notes||'None recorded.')}</p>
 <p>Code generation requires approval of the exact source and design snapshot and full supported translation coverage. This report does not authorize generation or certify migration completeness.</p></main></html>`;
}
