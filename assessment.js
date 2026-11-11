import {distributedFindings} from './distributed.js';
// Findings are architecture hypotheses grounded in static evidence, never conformance scores.
export function assessSystem(report) {
  const programs=report.programs||[], nodes=report.flows.flatMap(f=>f.nodes);
  const findings=[];
  const add=(id,category,title,evidence,action,tradeoff,status='Candidate')=>
    findings.push({id,category,title,evidence,action,tradeoff,status,decision:'Open'});
  const mixed=programs.filter(p=>p.operations.some(o=>['COMPUTE','ADD','SUBTRACT','MULTIPLY','DIVIDE'].includes(o.kind))&&p.data.length);
  add('srp','SOLID','Single responsibility',mixed.flatMap(p=>[...p.operations.filter(o=>o.kind==='COMPUTE'),...p.data]).map(e=>e.ref+' · '+e.value),
    'Separate business policy, use-case orchestration and persistence responsibilities. Keep related invariants in one domain boundary.',
    'Additional layers are justified only where responsibilities change for different reasons.',mixed.length?'Risk signal':'Needs validation');
  const branches=nodes.filter(n=>n.decision);
  add('ocp','SOLID','Open / closed principle',branches.map(n=>n.ref+' · '+n.label),
    'Consider Strategy for independently varying pricing or eligibility policies. Retain straightforward conditional logic when the rules change together.',
    'A class for every IF would increase complexity. Confirm actual variation and change history.',branches.length?'Candidate':'Needs validation');
  add('lsp','SOLID','Liskov substitution',[],
    'Specify preconditions, postconditions and error behavior for interchangeable implementations, then run contract tests.',
    'Procedural source alone cannot establish inheritance or substitutability requirements.','Needs validation');
  add('isp','SOLID','Interface segregation',programs.flatMap(p=>p.calls).map(c=>c.ref+' · '+c.value),
    'Define narrow interfaces around consumer use cases. Separate batch commands, queries and external integration contracts.',
    'Consumer requirements and call arguments require review before selecting interface methods.','Needs validation');
  add('dip','SOLID','Dependency inversion',programs.flatMap(p=>[...p.data,...p.calls]).map(e=>e.ref+' · '+e.value),
    'Place persistence and external-system ports inside the application boundary. Infrastructure adapters implement those ports.',
    'Avoid adding interfaces to pure calculations with no external dependency.');
  add('model','Object-oriented design','Entities, value objects and invariants',programs.flatMap(p=>p.fields).map(f=>f.ref+' · '+f.value),
    'Group fields by business identity and lifecycle. Use value objects for amounts and identifiers, aggregate methods for invariant-preserving changes, and domain services for cross-object policy.',
    'PIC declarations identify storage shapes. Entity identity, ownership and invariants need business validation.','Needs validation');
  const resources=new Map();
  for(const p of programs) for(const item of p.data){
    const key=item.value.toUpperCase();
    if(!resources.has(key))resources.set(key,[]);
    resources.get(key).push({program:p.name,file:p.file,...item});
  }
  const shared=[...resources].filter(([,items])=>new Set(items.map(i=>i.file)).size>1);
  add('shared','Anti-patterns','Shared database / distributed monolith risk',shared.flatMap(([key,items])=>items.map(i=>i.ref+' · '+key+' used by '+i.program)),
    'Keep strongly coupled operations in one deployment initially. Define a single owner for each shared data resource before splitting services.',
    'Shared-resource names are static signals, not proof of common runtime tables.',shared.length?'Risk signal':'Needs validation');
  const deep=nodes.filter(n=>n.depth>=3);
  add('complexity','Anti-patterns','Deep procedural decision logic',deep.map(n=>n.ref+' · '+n.label),
    'Extract cohesive policies and introduce characterization tests before restructuring deeply nested decisions.',
    'Nesting is a complexity indicator, not proof of an incorrect business rule.',deep.length?'Risk signal':'Needs validation');
  const calls=programs.flatMap(p=>p.calls.map(c=>({...c,caller:p.name})));
  const cycleCalls=calls.filter(c=>c.kind==='static call'&&calls.some(other=>other.kind==='static call'&&other.caller.toUpperCase()===c.value.toUpperCase()&&other.value.toUpperCase()===c.caller.toUpperCase()));
  add('cycles','Anti-patterns','Bidirectional program dependencies',cycleCalls.map(c=>c.ref+' · '+c.caller+' → '+c.value),
    'Resolve bidirectional dependencies through an application orchestrator or a clearly owned contract.',
    'This check detects direct two-program cycles. Dynamic calls and longer cycles still require review.',cycleCalls.length?'Risk signal':'Needs validation');
  add('soa','SOA','Capability boundaries and contract ownership',calls.map(c=>c.ref+' · '+c.caller+' → '+c.value),
    'Define services around cohesive business capabilities and owned data. Confirm synchronous contracts, transaction boundaries and independent operational needs before deployment separation.',
    'Program count and paragraph count do not determine the number of services.','Needs validation');
  add('consistency','SOA','Consistency and recovery',programs.flatMap(p=>p.transactions).map(t=>t.ref+' · '+t.value),
    'Preserve local transaction invariants. Consider outbox delivery and idempotent consumers for committed asynchronous events. Use Saga only for validated cross-service workflows with compensations.',
    'Distributed messaging introduces retries, duplicate delivery and operational cost.','Needs validation');
  add('patterns','Design patterns','Ports, adapters, repositories and policies',programs.flatMap(p=>[...p.data,...p.operations.filter(o=>o.kind==='IF')]).map(e=>e.ref+' · '+e.value),
    'Use Repository for observed persistence, Adapter / anti-corruption layer for legacy interfaces, and Strategy where policy variation warrants it.',
    'Every pattern needs a concrete responsibility and tests. Avoid speculative factories and inheritance hierarchies.');
  return {findings:[...findings,...distributedFindings(programs)].map(f=>f.evidence.length?f:{...f,decision:'Not applicable',automatic:true,notes:'Automatically marked Not applicable: no supporting source evidence was found. This is an evidence-based screening decision, not proof that the principle is irrelevant at runtime. Revisit if operational or business requirements provide evidence.'}),resources:[...resources].map(([name,items])=>({name,items})),
    coverage:{programs:programs.length,flows:report.flows.length,unparsed:report.inventory.filter(file=>!programs.some(p=>p.file===file)),gaps:report.gaps.length},
    limits:['Static COBOL evidence does not establish full domain intent or runtime behavior.','Performance, scalability, availability, ownership and change frequency require operational input.','LSP, aggregate boundaries and event semantics require contract and domain validation.']};
}
export function proposeCapabilities(report, modules) {
  // Co-locate programs sharing an observed data resource; users refine domain ownership.
  const groups=modules.map((module,index)=>({indexes:[index],resources:new Set((report.programs[index]?.data||[]).map(d=>d.value.toUpperCase()))}));
  for(let i=0;i<groups.length;i++){
    for(let j=i+1;j<groups.length;){
      if([...groups[i].resources].some(r=>groups[j].resources.has(r))){
        groups[i].indexes.push(...groups[j].indexes);
        for(const r of groups[j].resources)groups[i].resources.add(r);
        groups.splice(j,1);j=i+1;
      }else j++;
    }
  }
  return groups.map((group,index)=>{
    const members=group.indexes.map(i=>modules[i]);
    return { ...members[0],
      name:members.length>1?'Capability group '+(index+1):members[0].name+' capability',
      sources:members.flatMap(m=>m.sources||[m.source]),
      responsibility:'Own the behavior and data invariants for '+members.map(m=>m.name).join(', '),
      reason:members.length>1?'Co-located because static analysis found shared data access. Validate resource identity and domain cohesion.':'Initial candidate requiring domain-owner validation; refine or combine with another capability.',
      operations:members.flatMap(m=>m.operations),fields:members.flatMap(m=>m.fields),
      adapters:[...new Set(members.flatMap(m=>m.adapters))],sourceEvidence:members.flatMap(m=>m.sourceEvidence)
    };
  });
}
