import {ArchitectureReview,BusinessDiagram,SystemMap} from './review-ui.js';
import {translationReport} from './translator.js';
import {pendingReviews} from './migration-report.js';
import {createMigrationPdf} from './report-pdf.js';
import {IdeaDesigner} from './idea-ui.js';
import {AIControls,AIGeneration,aiRequest} from './ai-ui.js';
import React,{useState} from './vendor/react.js';
import {createRoot} from './vendor/react-dom.js';
import {analyze,edges,architecture,sample} from './analyzer.js';
import {reviewSnapshot,approveSnapshot,isApproved,generateProject,zipFiles} from './generator.js';
const h=React.createElement;
function App(){
 const [files,setFiles]=useState([]),[report,setReport]=useState(null),[format,setFormat]=useState('fixed'),[tab,setTab]=useState(0),[selected,setSelected]=useState(0),[plan,setPlan]=useState(null),[scale,setScale]=useState('modular'),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const [notes,setNotes]=useState(''),[reviewed,setReviewed]=useState(false),[approval,setApproval]=useState(null);
 const [workspace,setWorkspace]=useState('legacy');
 const snapshot=reviewSnapshot(files,report,plan,notes);
 const approved=isApproved(snapshot,approval);
 const translation=report?translationReport(files,report):{supported:[],blocked:[]};
 const pending=pendingReviews(plan);
 function invalidate(){if(approval)setStatus('Design changed. Review and approve the updated proposal.');setApproval(null);setReviewed(false);}
 async function approve(){
  if(!reviewed||!plan)return;
  try{const receipt=await approveSnapshot(snapshot);
  const backend=plan.ai?await aiRequest('approve',{snapshot}):{};
  setApproval({...receipt,...backend});setStatus('Architecture approved. Generation remains subject to the implementation coverage shown below.');}catch(error){setStatus(error.message);}
 }
 function downloadReport(){
  try{
   createMigrationPdf(snapshot,approval,window.jspdf.jsPDF).save('legacy-migration-report.pdf');
   setStatus('PDF report downloaded with current architecture, proposed capabilities, Spring Boot component diagrams and reviewed design applicability.');
  }catch(error){setStatus(error.message);}
 }
 function generate(){
  try{
   const artifact=zipFiles(generateProject(snapshot,approval));
   const url=URL.createObjectURL(artifact),link=document.createElement('a');
   link.href=url;link.download='approved-spring-boot.zip';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setStatus('Generated the approved Spring Boot project. Check your browser downloads.');
  }catch(error){setStatus(error.message);}
 }
 const reset=data=>{invalidate();setNotes('');setFiles(data);setReport(null);setPlan(null);setTab(0);setSelected(0);};
 async function upload(event){
  const chosen=[...event.target.files].filter(f=>!/(^|\/)(node_modules|\.git|target|vendor)(\/|$)/.test(f.webkitRelativePath));
  event.target.value='';
  setBusy(true);setStatus('Reading selected repository…');
  try{
   const relevant=chosen.filter(f=>/\.(cbl|cob|cobol|cpy|cl|clle|rpg|rpgle|dds|sql)$/i.test(f.name));
   if(relevant.length>2000||relevant.reduce((s,f)=>s+f.size,0)>20000000)throw Error('Select up to 2,000 source files and 20 MB.');
   const data=[];
   for(const file of relevant){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
    data.push({name:file.webkitRelativePath||file.name,text});
   }
   reset(data);setStatus(data.length+' relevant source files loaded. UTF-8 source required.');
  }catch(error){reset([]);setStatus(error.message);}finally{setBusy(false);}
 }
 function runAnalysis(){invalidate();const result=analyze(files,format);setReport(result);setPlan(null);setSelected(0);setTab(1);setStatus(result.flows.length+' flows extracted. Review evidence before architecture.');}
 function exportPlan(){
  const blob=new Blob([JSON.stringify({analysis:report,architecture:plan},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='migration-analysis.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const flow=report?.flows[selected];
 return h('div',{className:'shell'},
 h('aside',null,h('div',{className:'brand'},'◈',h('span',null,'FLOW',h('small',null,'LEGACY MODERNIZATION'))),
 h('p',{className:'eyebrow'},'YOUR WORKSPACE'),
 ['Repository','Business flows','Architecture'].map((label,index)=>h('button',{key:label,className:workspace==='legacy'&&tab===index?'nav active':'nav',disabled:index>0&&!report||index===2&&!plan,onClick:()=>{setWorkspace('legacy');setTab(index);}},h('b',null,'0'+(index+1)),label)),
 h('button',{className:workspace==='idea'?'nav active':'nav',onClick:()=>setWorkspace('idea')},h('b',null,'04'),'New system'),
 h('div',{className:'privacy'},h('strong',null,'You control AI access'),h('p',null,'Local analysis stays on this computer. OpenAI analysis sends selected inputs only when you enable it. API keys remain on the backend.'))),
 h('main',null,
 h('div',{className:'workspace-switch','aria-label':'Workspace mode'},h('button',{className:workspace==='legacy'?'':'secondary',onClick:()=>setWorkspace('legacy')},'Legacy migration'),h('button',{className:workspace==='idea'?'':'secondary',onClick:()=>setWorkspace('idea')},'New system from an idea')),
 h('div',{hidden:workspace!=='idea'},h(IdeaDesigner)),h('div',{hidden:workspace!=='legacy'},
 h('header',null,h('span',null,'Migration workspace / ',['Discover','Understand','Design'][tab]),h('span',{className:'badge'},'● Local workspace')),
 h('section',{className:'intro'},h('p',{className:'eyebrow'},'FROM LEGACY TO CLARITY'),h('h1',null,['Understand what you have.','Follow the business logic.','Design the next chapter.'][tab]),h('p',null,['Start with your source repository. Map its behavior before choosing a new architecture.','Trace decisions and operations back to the source. Review gaps before making design decisions.','An evidence-informed proposal for engineering review. Validate business boundaries with domain owners.'][tab])),
 status&&h('p',{role:'status',className:'status'},status),
 tab===0&&h('section',{className:'panel'},
 h('div',{className:'upload'},h('div',{className:'folder'},'▱'),h('h2',null,'Connect a legacy repository'),h('p',null,'Select a local checkout containing COBOL source. CL, RPG, DDS and SQL files are inventoried for review.'),
 h('label',{className:'button'},busy?'Reading…':'Choose repository folder',h('input',{type:'file',webkitdirectory:'',multiple:true,disabled:busy,onChange:upload,style:{display:'none'}})),
 h('button',{className:'secondary',onClick:()=>{reset(sample);setStatus('Loaded the built-in pricing example.');}},'Try sample repository')),
 h('div',{className:'settings'},h('label',null,'COBOL format ',h('select',{value:format,onChange:e=>{invalidate();setFormat(e.target.value);setReport(null);setPlan(null);}},h('option',{value:'fixed'},'Fixed columns 8–72'),h('option',{value:'free'},'Free format'))),h('span',null,files.length+' source files')),
 h('div',{className:'filelist'},files.map(f=>h('div',{key:f.name},'▤  '+f.name))),
 h('button',{disabled:!files.length||busy,onClick:runAnalysis},'Generate business flows →')),
 tab===0&&h(AIControls,{payload:{mode:'legacy',files,format,deployment:scale},disabled:!files.length||busy,onResult:result=>{invalidate();setReport(result.report);setPlan(result.plan);setSelected(0);setTab(2);setStatus('OpenAI architecture ready. Review AI business rules, source evidence and all design findings.');}}),
 tab===1&&h(React.Fragment,null,
 h('div',{className:'metrics'},[['SOURCE FILES',report.inventory.length],['BUSINESS FLOWS',report.flows.length],['REVIEW GAPS',report.gaps.length]].map(([label,value])=>h('div',{className:'panel',key:label},h('small',null,label),h('strong',null,value)))),
 h('section',{className:'panel'},h('details',null,h('summary',null,'Explore whole-system dependencies'),h(SystemMap,{report}))),
 h('section',{className:'panel'},h('div',{className:'settings'},h('h2',null,'Flow explorer'),h('select',{'aria-label':'Business flow',value:selected,onChange:e=>setSelected(Number(e.target.value))},report.flows.map((f,i)=>h('option',{value:i,key:i},f.name+' · '+f.file)))),
 flow?.uncertain&&h('p',{className:'warning'},'Partial source map. Control-flow connections are hidden because this paragraph includes unsupported syntax.'),
 h(BusinessDiagram,{key:flow?.file+flow?.name,flow}),
 h('details',null,h('summary',null,'Source evidence'),flow?.nodes.map(n=>h('pre',{key:n.ref},n.ref+'\n'+n.label)))),
 h('section',{className:'panel'},h('h2',null,'Review before designing'),h('p',null,'Diagrams cover explicit IF / ELSE / END-IF branches and source operations. Calls, loops, SQL and implicit scopes require manual analysis. Business names are taken from paragraph labels.'),
 report.gaps.map((gap,i)=>h('p',{className:'warning',key:i},gap)),
 h('label',null,'Deployment objective ',h('select',{value:scale,onChange:e=>{invalidate();setPlan(null);setScale(e.target.value);}},h('option',{value:'modular'},'Modular application'),h('option',{value:'independent'},'Independent service scaling'))),
 h('button',{disabled:!report.flows.length,onClick:()=>{invalidate();setPlan(architecture(report,scale));setTab(2);}},'Create architecture proposal →'))),
 tab===2&&plan&&h(React.Fragment,null,
 h('section',{className:'panel'},h('span',{className:'badge'},approved?'ARCHITECTURE APPROVED':'PROPOSED · SYSTEM DESIGN REVIEW'),h('h2',null,plan.style),h('p',null,plan.rationale),
 h('p',null,'Architecture approval captures the proposed capabilities and your assessment decisions.')),
 h(ArchitectureReview,{report,plan,onChange:next=>{invalidate();setPlan(next);}}),
 h('button',{className:'secondary',onClick:exportPlan},'Export complete design review'),
 h('section',{className:'panel'},h('h2',null,'Migration analysis report'),
 h('p',null,'An illustrated PDF document with current architecture, proposed capability diagrams, a Spring Boot component design, business rules, reviewed decisions and migration blockers.'),
 h('p',null,pending.length?pending.length+' evidence-backed design aspects need review. Aspects without source evidence are automatically marked Not applicable. Add rationale when choosing Not applicable, Investigate or Defer with notes.':'All required applicability reviews are complete. The PDF is available even when code translation is blocked.'),
 h('button',{className:'secondary',disabled:!!pending.length,onClick:downloadReport},'Download migration report (PDF)')),
 h('section',{className:'panel'},
 h('h2',null,'Approve the system design'),
 h('p',null,'The generation coverage below describes executable numeric rules. Your approved capability boundaries determine their project grouping. Domain entities, aggregates, persistence adapters and distributed workflows require further implementation.'),
 h('p',null,plan.style==='Candidate service boundaries'?'Each proposed service receives a separate Maven project.':'The approved modules share one Maven application.'),
 h('p',null,translation.supported.length+' executable flows · '+translation.blocked.length+' blocked flows'),
 translation.supported.map(rule=>h('p',{key:rule.id},rule.id+' — inputs: '+rule.inputs.join(', ')+' → outputs: '+rule.outputs.join(', '))),
 translation.blocked.map(item=>h('p',{key:item.id,className:'warning'},item.id+' — '+item.reason)),
 h('label',null,'Architecture review notes',h('textarea',{value:notes,rows:4,style:{display:'block',width:'100%',margin:'12px 0',padding:12},onChange:e=>{invalidate();setNotes(e.target.value);},placeholder:'Record assumptions and engineering review decisions. Notes do not automatically change the design.'})),
 h('label',null,h('input',{type:'checkbox',checked:reviewed,onChange:e=>{setReviewed(e.target.checked);setApproval(null);}}),' I reviewed the architecture, analysis gaps, and generation scope.'),
 h('button',{disabled:!reviewed||approved,onClick:approve},approved?'Architecture approved':'Approve architecture'),
 h('div',{className:'status',role:'note'},h('strong',null,'Code generation readiness'),
 h('p',null,!approved?'Step 1: Check the review acknowledgment, then select Approve architecture. Any design edit requires fresh approval.':'Step 1 complete: Current architecture approved.'),
 h('p',null,translation.blocked.length?'Step 2: '+translation.blocked.length+' flows cannot yet be translated safely. Review the source-specific reasons above. Approval cannot resolve unsupported COBOL syntax; those flows require translator implementation and parity tests.':translation.supported.length?'Step 2 complete: All analyzed flows have executable translation coverage.':'Step 2: No executable rules found. Check the COBOL format and source files, then analyze again.')),
 h('button',{className:'secondary',disabled:!approved,onClick:generate},translation.blocked.length||!translation.supported.length?'Check Spring Boot generation blockers':'Generate Spring Boot ZIP'),
 plan.ai&&h(AIGeneration,{snapshot,approval:approved?approval:null}),
 approval&&approved&&h('p',{className:'status'},'Approved '+new Date(approval.approvedAt).toLocaleString()+' · SHA-256 '+approval.sha256),
 h('p',null,'Changing the repository, analysis, deployment objective, or review notes requires approval again. Approval applies only to this browser session.')) ),
 h('footer',null,'Legacy Flow Studio',h('span',null,'Discover → Understand → Design')))));
}
createRoot(document.getElementById('root')).render(h(App));
