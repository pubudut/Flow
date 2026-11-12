import React,{useState} from './vendor/react.js';
import {SystemMap} from './diagram-ui.js';
import {pendingReviews} from './migration-report.js';
export {SystemMap,BusinessDiagram} from './diagram-ui.js';
const h=React.createElement;
export function ArchitectureReview({report,plan,onChange}){
 const [view,setView]=useState('Overview'),[category,setCategory]=useState('Needs review'),[search,setSearch]=useState('');
 const pendingIds=new Set(pendingReviews(plan).map(f=>f.id));
 const assessment=plan.assessment;
 const isIdea=report.kind==='idea';
 if(!assessment)return null;
 function updateFinding(id,changes){onChange({...plan,assessment:{...assessment,findings:assessment.findings.map(f=>f.id===id?{...f,...changes,automatic:false}:f)}});}
 return h('section',{className:'panel review-workspace'},
 plan.ai&&h('p',{className:'status'},'AI-generated proposal · '+plan.ai.model+' · Validate evidence and assumptions before approval.'),
 h('div',{className:'review-tabs'},['Overview',isIdea?'Requirements':'Current system','Target design',...(plan.ai?['AI business rules']:[]),'Assessment',isIdea?'Delivery plan':'Migration plan'].map(name=>h('button',{className:view===name?'selected':'secondary',key:name,onClick:()=>setView(name)},name))),
 view==='AI business rules'&&h('div',null,h('h2',null,'AI business-rule interpretation'),h('p',null,'Check nested conditions, calculations and exceptions against the references. These are model interpretations, not verified runtime behavior.'),(report.aiBusinessRules||[]).map((rule,i)=>h('article',{key:i,className:'finding'},h('h3',null,rule.name),h('p',null,rule.description),rule.evidence.map((e,j)=>h('pre',{key:j},e))))),
 view==='Overview'&&h('div',null,h('h2',null,'Whole-system design review'),h('p',null,isIdea?'Inspect the requirements, refine capability boundaries, then evaluate the design findings before approval.':'Inspect the current dependencies, refine capability boundaries, then evaluate the design findings before approval.'),
 h('div',{className:'metrics'},(isIdea?[['REQUIREMENTS',report.requirements.length],['CAPABILITIES',plan.modules.length],['DESIGN ASPECTS',assessment.findings.length]]:[['PROGRAMS',assessment.coverage.programs],['UNPARSED FILES',assessment.coverage.unparsed.length],['RISK SIGNALS',assessment.findings.filter(f=>f.status==='Risk signal').length]]).map(([label,value])=>h('div',{className:'panel',key:label},h('small',null,label),h('strong',null,value)))),
 h('h3',null,'What needs your judgment'),assessment.limits.map(limit=>h('p',{key:limit},limit)),h('p',{className:'warning'},isIdea?'Findings are requirement-based design hypotheses, not proof of architecture compliance.':'Findings are static evidence and design hypotheses. No SOLID compliance score is inferred from procedural source.')),
 view==='Requirements'&&h('div',null,h('h2',null,'Requirements and evidence'),h('p',null,'These statements come from the supplied idea and constraints. There is no existing source architecture to infer.'),report.requirements.map(r=>h('article',{className:'finding',key:r.ref},h('strong',null,r.ref),h('p',null,r.value)))),
 view==='Current system'&&h('div',null,h(SystemMap,{report}),h('details',null,h('summary',null,'All dependencies and unresolved targets'),plan.integration.map((item,i)=>h('p',{key:i},item)),plan.coupling.map((item,i)=>h('p',{key:'c'+i},item)))),
 view==='Target design'&&h('div',null,h(SystemMap,{report,plan}),h('p',null,'Refine capability names and responsibilities. Combine related capabilities where business ownership and invariants agree. Changes invalidate approval.'),
 plan.modules.map((module,index)=>h('div',{className:'capability-editor',key:index},
 h('label',null,'Capability name',h('input',{value:module.name,onChange:e=>onChange({...plan,modules:plan.modules.map((m,i)=>i===index?{...m,name:e.target.value}:m)})})),
 h('label',null,'Business responsibility',h('textarea',{value:module.responsibility,onChange:e=>onChange({...plan,modules:plan.modules.map((m,i)=>i===index?{...m,responsibility:e.target.value}:m)})})),
 h('small',null,(module.sources||[module.source]).join(' · ')),
 h('p',null,module.reason),
 index>0&&h('button',{className:'secondary',onClick:()=>{
 const modules=[...plan.modules],previous=modules[index-1];
 modules[index-1]={...previous,sources:[...new Set([...(previous.sources||[previous.source]),...(module.sources||[module.source])])],operations:[...previous.operations,...module.operations],fields:[...previous.fields,...module.fields],adapters:[...new Set([...previous.adapters,...module.adapters])],sourceEvidence:[...previous.sourceEvidence,...module.sourceEvidence],responsibility:previous.responsibility+'; '+module.responsibility,reason:'Combined by reviewer to preserve business cohesion.'};
 modules.splice(index,1);onChange({...plan,modules});}},'Combine with previous capability')))),
 view==='Assessment'&&h('div',null,h('p',{className:'status'},pendingIds.size+' aspects need review · '+assessment.findings.filter(f=>f.automatic).length+' automatically marked Not applicable. Use All to inspect or override automatic decisions.'),h('div',{className:'review-tabs'},['Needs review','All','SOLID','Object-oriented design','SOA','Anti-patterns','Design patterns','Distributed systems'].map(name=>h('button',{key:name,className:category===name?'selected':'secondary',onClick:()=>setCategory(name)},name))),
 h('label',null,'Find a principle or pattern',h('input',{type:'search',value:search,onChange:e=>setSearch(e.target.value),placeholder:'Search assessments…',className:'assessment-search'})),
 assessment.findings.filter(f=>(category==='All'||category==='Needs review'&&pendingIds.has(f.id)||f.category===category)&&f.title.toLowerCase().includes(search.toLowerCase())).map(f=>h('article',{className:'finding',key:f.id},
 h('span',{className:'badge'},f.category+' · '+f.status),h('h3',null,f.title),
 f.automatic&&h('p',{className:'status'},'Automatically marked Not applicable — no supporting '+(isIdea?'requirement':'source')+' evidence. No review required. You can override this when additional requirements justify applicability.'),
 h('p',null,f.action),f.when&&h('p',{className:'applicability'},f.when),h('p',{className:'tradeoff'},f.tradeoff),
 h('details',null,h('summary',null,f.evidence.length+(isIdea?' requirement references':' source observations')),f.evidence.length?f.evidence.map((e,i)=>h('pre',{key:i},e)):h('p',null,'Insufficient evidence. Resolve this through domain, contract and operational review.')),
 h('label',null,'Review disposition ',h('select',{value:f.decision,onChange:e=>updateFinding(f.id,{decision:e.target.value})},['Open','Applicable','Not applicable','Accept recommendation','Investigate','Defer with notes'].map(value=>h('option',{key:value},value)))),
 h('label',null,'Decision rationale',h('textarea',{value:f.notes||'',rows:2,onChange:e=>updateFinding(f.id,{notes:e.target.value}),placeholder:'Explain applicability, assumptions or follow-up work.'}))))),
 view==='Delivery plan'&&h('div',null,h('h2',null,'Build by validated capability'),plan.decisions.map((d,i)=>h('article',{key:i,className:'finding'},d)),plan.gaps.map((g,i)=>h('p',{key:i,className:'warning'},g)),h('p',null,'Define acceptance examples, API contracts and threat models before implementation. Implement one vertical use case, then validate behavior, load and recovery.')),
 view==='Migration plan'&&h('div',null,h('h2',null,'Modernize by business capability'),[
 ['1 · Capture behavior','Record representative inputs, outputs, side effects and transaction boundaries for each capability.'],
 ['2 · Design the domain','Validate identities, value objects, aggregate invariants and narrow use-case contracts with business owners.'],
 ['3 · Isolate infrastructure','Introduce ports and adapters around observed persistence and integration points. Preserve atomicity.'],
 ['4 · Refactor policies','Apply Strategy or domain services only where variation and cohesion justify them. Verify behavior with characterization tests.'],
 ['5 · Move traffic gradually','Use Strangler Fig routing, compare results and define rollback conditions. Validate load, recovery and observability.']
 ].map(([title,body])=>h('article',{className:'finding',key:title},h('h3',null,title),h('p',null,body))),
 h('p',{className:'warning'},'The current generator implements supported numeric behavior inside approved capability projects. Entity/aggregate design, persistence adapters and distributed orchestration still require implementation.'),
 h('a',{href:'https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis',target:'_blank',rel:'noreferrer'},'Domain analysis and bounded contexts')));
}
