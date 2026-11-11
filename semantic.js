import {assessSystem,proposeCapabilities} from './assessment.js';
// Conservative source evidence extraction. References retain physical line numbers.
export function inspectProgram(file, format) {
  const program={name:file.name.split('/').pop(),file:file.name,fields:[],calls:[],copies:[],operations:[],data:[],transactions:[],issues:[]};
  let sql=null;
  const add=(collection,kind,value,ref)=>collection.push({kind,value,ref});
  for(const [index,raw] of file.text.split(/\r?\n/).entries()){
    const ref=file.name+':'+(index+1);
    if(format==='fixed'&&['*','/'].includes(raw[6]))continue;
    if(format==='fixed'&&raw[6]&&raw[6]!==' '){
      program.issues.push(ref+' — continuation/debug source requires review.');continue;
    }
    const line=(format==='fixed'?raw.slice(7,72):raw).trim();
    if(!line||line.startsWith('*>'))continue;
    let match;
    if((match=line.match(/^PROGRAM-ID\.\s*([\w-]+)/i)))program.name=match[1];
    if((match=line.match(/^\d{2}\s+([\w-]+)\s+(?:PIC|PICTURE)\s+([^ .]+(?:\.[^ ]+)?)/i)))add(program.fields,'picture',match[1]+' '+match[2],ref);
    if((match=line.match(/^COPY\s+["']?([\w./-]+?)(?:["']|\s|\.$|$)/i)))add(program.copies,'copybook',match[1],ref);
    if((match=line.match(/^CALL\s+(?:(["'])([^"']+)\1|([\w-]+))/i)))add(program.calls,match[1]?'static call':'dynamic call',match[2]||match[3],ref);
    if(/^(IF|EVALUATE|WHEN|COMPUTE|ADD|SUBTRACT|MULTIPLY|DIVIDE|PERFORM)\b/i.test(line))add(program.operations,line.split(/\s/)[0].toUpperCase(),line,ref);
    if((match=line.match(/^(READ|WRITE|REWRITE|DELETE|OPEN|CLOSE)\s+(.+)/i)))add(program.data,match[1].toUpperCase(),match[2].replace(/^(INPUT|OUTPUT|I-O|EXTEND)\s+/i,'').split(/\s/)[0].replace(/\.$/,''),ref);
    if(/COMMIT|ROLLBACK|SYNCPOINT/i.test(line))add(program.transactions,'transaction',line,ref);
    if(/^EXEC\s+SQL/i.test(line))sql={text:line,ref};
    else if(sql)sql.text+=' '+line;
    if(sql&&/END-EXEC/i.test(line)){
      for(const table of sql.text.matchAll(/\b(FROM|JOIN|UPDATE|INTO)\s+([\w.]+)/gi))add(program.data,'SQL '+table[1].toUpperCase(),table[2],sql.ref);
      sql=null;
    }
  }
  if(sql)program.issues.push(sql.ref+' — unterminated SQL block.');
  return program;
}
export function designFromEvidence(report,scale){
  const programs=report.programs||[];
  const names=new Set(programs.map(p=>p.name.toUpperCase()));
  const shared=new Map();
  for(const program of programs){
    for(const resource of [...program.data,...program.copies]){
      const key=resource.value.toUpperCase();
      if(!shared.has(key))shared.set(key,new Set());
      shared.get(key).add(program.name);
    }
  }
  const coupling=[...shared].filter(([,owners])=>owners.size>1).map(([resource,owners])=>resource+' shared by '+[...owners].join(', '));
  const modules=programs.map(program=>{
    const flows=report.flows.filter(f=>f.file===program.file);
    const hasData=program.data.length>0,hasBatch=program.operations.some(o=>o.kind==='PERFORM');
    return {
      name:program.name,source:program.file,
      responsibility:'Preserve '+program.name+' behavior across '+flows.map(f=>f.name).join(', '),
      reason:'Program boundary from PROGRAM-ID; paragraphs stay together pending domain and transaction review.',
      operations:program.operations,
      fields:program.fields,
      adapters:[
        ...(hasData?['Persistence adapter for '+[...new Set(program.data.map(d=>d.value))].join(', ')]:[]),
        ...program.calls.map(c=>(c.kind==='dynamic call'?'Resolve dynamic integration target ':'Program integration port for ')+c.value),
        ...(hasBatch?['Batch/use-case orchestration for PERFORM targets']:[])
      ],
      sourceEvidence:[...program.fields,...program.data,...program.calls,...program.copies,...program.transactions],
      validation:flows.some(f=>f.uncertain)?'Partial control flow; validate unsupported paths before migration.':'Validate branch outcomes and decimal precision against legacy execution.'
    };
  });
  const integration=programs.flatMap(p=>p.calls.map(c=>p.name+' → '+c.value+' ('+(c.kind==='static call'&&names.has(c.value.toUpperCase())?'repository program':'unresolved/external target')+') · '+c.ref));
  const transactions=programs.flatMap(p=>p.transactions);
  const gaps=[...report.gaps,...programs.flatMap(p=>p.issues),...coupling.map(c=>'Shared-resource ownership to resolve: '+c)];
  return {
    style:scale==='independent'?'Candidate service boundaries':'Modular Spring Boot application',
    rationale:'Derived from '+programs.length+' COBOL programs, '+report.flows.length+' paragraph flows and '+programs.reduce((n,p)=>n+p.operations.length,0)+' business/control operations. '+(scale==='independent'?'Service separation requires validation of the coupling listed below.':'Keep program operations together initially and refine domain boundaries with business owners.'),
    modules:proposeCapabilities(report,modules),assessment:assessSystem(report),integration:integration.length?integration:['No static program calls found. Validate dynamic, batch and platform dependencies.'],
    gaps,coupling,
    decisions:[
      'Preserve '+modules.map(m=>m.name).join(', ')+' as initial application modules. Keep calculations in domain services and expose use-case interfaces.',
      ...(programs.some(p=>p.data.length)?['Move observed file/SQL access behind repository ports. Map records, keys and locking before selecting a target schema.']:['No file or SQL resources identified. Confirm whether data is supplied through linkage or external jobs.']),
      ...(transactions.length?['Preserve observed transaction boundaries at '+transactions.map(t=>t.ref).join(', ')+'. Avoid splitting these operations across services until consistency is designed.']:['Transaction boundaries are unknown. Establish atomic operations and rollback behavior before splitting services.']),
      'Use BigDecimal and explicit COBOL picture/rounding mappings for numeric business operations; validate overflow and truncation behavior.',
      'Migrate one validated use case at a time behind Strangler Fig routing. Compare results against captured legacy cases before switching traffic.',
      'Define throughput, latency and recovery objectives with operators. Use health probes, tracing and load tests to validate the target.'
    ]
  };
}
