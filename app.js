import {ArchitectureReview,BusinessDiagram,SystemMap} from './review-ui.js';
import {pendingReviews} from './migration-report.js';
import {createMigrationPdf} from './report-pdf.js';
import {IdeaDesigner} from './idea-ui.js';
import {AIConfiguration,AIGeneration,aiRequest} from './ai-ui.js';
import React,{useState} from './vendor/react.js';
import {createRoot} from './vendor/react-dom.js';
import {sample} from './analyzer.js';
import {reviewSnapshot,approveSnapshot,isApproved} from './generator.js';
const h=React.createElement;
function App(){
 const [files,setFiles]=useState([]),[report,setReport]=useState(null),[format,setFormat]=useState('fixed'),[tab,setTab]=useState(0),[selected,setSelected]=useState(0),[plan,setPlan]=useState(null),[scale,setScale]=useState('modular'),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const [notes,setNotes]=useState(''),[reviewed,setReviewed]=useState(false),[approval,setApproval]=useState(null);
 const [workspace,setWorkspace]=useState('legacy');
 const snapshot=reviewSnapshot(files,report,plan,notes);
 const approved=isApproved(snapshot,approval);
 const pending=pendingReviews(plan);
 function invalidate(){if(approval)setStatus('Design changed. Review and approve the updated proposal.');setApproval(null);setReviewed(false);}
 async function approve(){
  if(!reviewed||!plan)return;
  try{const receipt=await approveSnapshot(snapshot);
  const backend=plan.ai?await aiRequest('approve',{snapshot}):{};
  setApproval({...receipt,...backend});setStatus('Architecture approved. You can now generate the Spring Boot project from this design.');}catch(error){setStatus(error.message);}
 }
 function downloadReport(){
  try{
   createMigrationPdf(snapshot,approval,window.jspdf.jsPDF).save('legacy-migration-report.pdf');
   setStatus('PDF report downloaded with current architecture, proposed capabilities, Spring Boot component diagrams and reviewed design applicability.');
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
 async function runAnalysis(){
  invalidate();setBusy(true);setReport(null);setPlan(null);setStatus('Analyzing business flows and proposing a modern architecture. This can take several minutes.');
  try{const result=await aiRequest('analyze',{mode:'legacy',files,format,deployment:scale,consent:true});setReport(result.report);setPlan(result.plan);setSelected(0);setTab(1);setStatus(result.report.flows.length+' AI business flows ready. Review the source evidence, then open the proposed modern solution.');}
  catch(error){setStatus(error.message);}finally{setBusy(false);}
 }
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
 h('button',{className:workspace==='configuration'?'nav active':'nav',onClick:()=>setWorkspace('configuration')},h('b',null,'05'),'Configuration'),
 h('div',{className:'privacy'},h('strong',null,'You control AI access'),h('p',null,'Design and analysis actions send selected inputs to the configured AI provider. Review and approval happen here. API keys remain on the backend.'))),
 h('main',null,
 h('div',{className:'workspace-switch','aria-label':'Workspace mode'},h('button',{className:workspace==='legacy'?'':'secondary',onClick:()=>setWorkspace('legacy')},'Legacy migration'),h('button',{className:workspace==='idea'?'':'secondary',onClick:()=>setWorkspace('idea')},'New system from an idea')),
 workspace==='configuration'&&h(AIConfiguration),
 h('div',{hidden:workspace!=='idea'},h(IdeaDesigner,{onConfigure:()=>setWorkspace('configuration')})),h('div',{hidden:workspace!=='legacy'},
 h('header',null,h('span',null,'Migration workspace / ',['Discover','Understand','Design'][tab]),h('span',{className:'badge'},'● Local workspace')),
 h('section',{className:'intro'},h('p',{className:'eyebrow'},'FROM LEGACY TO CLARITY'),h('h1',null,['Understand what you have.','Follow the business logic.','Design the next chapter.'][tab]),h('p',null,['Start with your source repository. Map its behavior before choosing a new architecture.','Trace decisions and operations back to the source. Review gaps before making design decisions.','An evidence-informed proposal for engineering review. Validate business boundaries with domain owners.'][tab])),
 status&&h('p',{role:'status',className:'status'},status),
 status&&/configur|API key|quota|billing|backend/i.test(status)&&h('button',{className:'secondary',onClick:()=>setWorkspace('configuration')},'Open Configuration'),
 tab===0&&h('section',{className:'panel'},
 h('div',{className:'upload'},h('div',{className:'folder'},'▱'),h('h2',null,'Connect a legacy repository'),h('p',null,'Select a local checkout containing COBOL source. CL, RPG, DDS and SQL files are inventoried for review.'),
 h('label',{className:'button'},busy?'Reading…':'Choose repository folder',h('input',{type:'file',webkitdirectory:'',multiple:true,disabled:busy,onChange:upload,style:{display:'none'}})),
 h('button',{className:'secondary',disabled:busy,onClick:()=>{reset(sample);setStatus('Loaded the built-in pricing example.');}},'Try sample repository')),
 h('div',{className:'settings'},h('label',null,'COBOL format ',h('select',{disabled:busy,value:format,onChange:e=>{invalidate();setFormat(e.target.value);setReport(null);setPlan(null);}},h('option',{value:'fixed'},'Fixed columns 8–72'),h('option',{value:'free'},'Free format'))),h('span',null,files.length+' source files')),
 h('div',{className:'filelist'},files.map(f=>h('div',{key:f.name},'▤  '+f.name))),
 h('label',null,'Deployment objective ',h('select',{disabled:busy,value:scale,onChange:e=>{invalidate();setReport(null);setPlan(null);setScale(e.target.value);}},h('option',{value:'modular'},'Modular application'),h('option',{value:'independent'},'Independent service scaling'))),
 h('p',{className:'design-disclosure'},'Generate business flows sends the selected source to the configured AI provider to analyze behavior and propose a modern architecture. Provider limits and usage charges may apply. Maximum 240 KB of source per request.'),
 h('button',{disabled:!files.length||busy,onClick:runAnalysis},busy?'Analyzing system…':'Generate business flows →')),
 tab===1&&h(React.Fragment,null,
 h('div',{className:'metrics'},[['SOURCE FILES',report.inventory.length],['BUSINESS FLOWS',report.flows.length],['REVIEW GAPS',report.gaps.length]].map(([label,value])=>h('div',{className:'panel',key:label},h('small',null,label),h('strong',null,value)))),
 h('section',{className:'panel'},h('details',null,h('summary',null,'Explore whole-system dependencies'),h(SystemMap,{report}))),
 h('section',{className:'panel'},h('div',{className:'settings'},h('h2',null,'Flow explorer'),h('select',{'aria-label':'Business flow',value:selected,onChange:e=>setSelected(Number(e.target.value))},report.flows.map((f,i)=>h('option',{value:i,key:i},f.name+' · '+f.file)))),
 flow?.uncertain&&h('p',{className:'warning'},'AI marked this flow as uncertain. Review its limitations and source references before relying on the diagram.'),
 h(BusinessDiagram,{key:flow?.file+flow?.name,flow}),
 h('details',null,h('summary',null,'Source evidence'),flow?.nodes.map(n=>h('pre',{key:n.id},n.label+'\n'+(n.evidence||[n.ref]).join('\n'))))),
 h('section',{className:'panel'},h('h2',null,'Review before designing'),h('p',null,'These business flows and the proposed modern solution are generated by the configured AI provider from the selected source. Validate decisions, calculations, exceptions and source references. AI interpretations are not verified runtime behavior.'),
 report.gaps.map((gap,i)=>h('p',{className:'warning',key:i},gap)),
 h('button',{disabled:!plan,onClick:()=>setTab(2)},'Review proposed modern solution →'))),
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
 h('p',null,'Review the AI business rules, capability boundaries and all evidence-backed design assessments. Approve this exact design before generating Spring Boot code.'),
 h('label',null,'Architecture review notes',h('textarea',{value:notes,rows:4,style:{display:'block',width:'100%',margin:'12px 0',padding:12},onChange:e=>{invalidate();setNotes(e.target.value);},placeholder:'Record assumptions and engineering review decisions. Notes do not automatically change the design.'})),
 h('label',null,h('input',{type:'checkbox',checked:reviewed,onChange:e=>{setReviewed(e.target.checked);setApproval(null);}}),' I reviewed the architecture, analysis gaps, and generation scope.'),
 h('button',{disabled:!reviewed||approved,onClick:approve},approved?'Architecture approved':'Approve architecture'),
 plan.ai&&h(AIGeneration,{snapshot,approval:approved?approval:null}),
 approval&&approved&&h('p',{className:'status'},'Approved '+new Date(approval.approvedAt).toLocaleString()+' · SHA-256 '+approval.sha256),
 h('p',null,'Changing the repository, analysis, deployment objective, or review notes requires approval again. Approval applies only to this browser session.')) ),
 h('footer',null,'Legacy Flow Studio',h('span',null,'Discover → Understand → Design')))));
}
createRoot(document.getElementById('root')).render(h(App));
