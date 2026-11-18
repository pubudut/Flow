import React,{useState,useEffect,useRef,useId} from './vendor/react.js';
import {edges} from './analyzer.js';
import {diagramNode,graphOptions} from './diagram-layout.js';
const h=React.createElement;
const engine=new window.ELK();
function Graph({title,nodes,connections,direction='DOWN',notice}){
 const [layout,setLayout]=useState(null),[error,setError]=useState(''),[zoom,setZoom]=useState(1),[selected,setSelected]=useState(null);
 const viewport=useRef(),svg=useRef(),marker=useId().replace(/:/g,'');
 const signature=JSON.stringify({nodes,connections,direction});
 function fit(result=layout){
  if(!result||!viewport.current)return;
  setZoom(Math.min(1,Math.max(.15,(viewport.current.clientWidth-48)/result.width)));
 }
 useEffect(()=>{
  let active=true;setLayout(null);setSelected(null);setError('');
  const graph={id:'root',layoutOptions:graphOptions(direction),children:nodes.map(({id,width,height})=>({id,width,height})),
   edges:connections.map((edge,index)=>({id:'edge'+index,sources:[edge.from],targets:[edge.to],
    labels:edge.label?[{text:edge.label,width:edge.label.length*8+20,height:26}]:[]}))};
  engine.layout(graph).then(result=>{if(active){setLayout(result);fit(result);}}).catch(err=>{if(active)setError('Diagram layout failed: '+err.message);});
  return ()=>{active=false;};
 },[signature]);
 function download(){
  if(!svg.current)return;
  const clone=svg.current.cloneNode(true);clone.setAttribute('width',layout.width);clone.setAttribute('height',layout.height);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
  const link=document.createElement('a');link.href=url;link.download=title.replace(/[^a-z0-9]/gi,'-')+'.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const chosen=nodes.find(n=>n.id===selected);
 const related=new Set(connections.filter(e=>e.from===selected||e.to===selected).flatMap(e=>[e.from,e.to]));
 return h('section',{className:'professional-diagram'},
 h('div',{className:'diagram-heading'},h('div',null,h('strong',null,title),h('small',null,nodes.length+' nodes · '+connections.length+' relationships')),
 h('div',{className:'diagram-tools'},
 h('button',{className:'secondary','aria-label':'Zoom out',onClick:()=>setZoom(z=>Math.max(.15,z-.15))},'−'),
 h('span',null,Math.round(zoom*100)+'%'),
 h('button',{className:'secondary','aria-label':'Zoom in',onClick:()=>setZoom(z=>Math.min(2,z+.15))},'+'),
 h('button',{className:'secondary',onClick:()=>fit()},'Fit width'),
 h('button',{className:'secondary',onClick:()=>setZoom(1)},'100%'),
 h('button',{className:'secondary',disabled:!layout,onClick:download},'Export SVG'))),
 notice&&h('p',{className:'warning'},notice),
 h('div',{className:'professional-viewport',ref:viewport},
 error?h('p',{role:'alert'},error):!layout?h('p',{role:'status'},'Arranging diagram…'):
 h('svg',{ref:svg,xmlns:'http://www.w3.org/2000/svg',width:layout.width*zoom,height:layout.height*zoom,viewBox:`0 0 ${layout.width} ${layout.height}`,role:'group','aria-label':title},
 h('defs',null,h('marker',{id:marker,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto'},h('path',{d:'M0 0 L10 5 L0 10Z',fill:'#647c88'}))),
 h('rect',{width:layout.width,height:layout.height,fill:'#f8fafc'}),
 layout.edges.map((edge,index)=>{
  const source=connections[index],highlight=!selected||source.from===selected||source.to===selected;
  return h('g',{key:edge.id,opacity:highlight?1:.18},
   edge.sections?.map((section,i)=>{
    const points=[section.startPoint,...(section.bendPoints||[]),section.endPoint];
    return h('path',{key:i,d:points.map((point,j)=>(j?'L':'M')+point.x+' '+point.y).join(' '),fill:'none',stroke:source.label==='No'?'#b38b48':'#647c88',strokeWidth:highlight&&selected?3:1.8,strokeLinejoin:'round','marker-end':`url(#${marker})`,strokeDasharray:source.proposed?'6 5':undefined});
   }),
   edge.labels?.map((label,i)=>h('g',{key:'label'+i},h('rect',{x:label.x,y:label.y,width:label.width,height:label.height,rx:5,fill:'#fff',stroke:'#dce3ea'}),h('text',{x:label.x+10,y:label.y+17,fontFamily:'Arial, sans-serif',fontSize:12,fontWeight:600,fill:'#496272'},label.text))));
 }),
 layout.children.map(node=>{
  const info=nodes.find(n=>n.id===node.id),decision=info.kind==='Decision',resource=info.kind==='Data resource'||info.kind==='Adapter';
  const color=decision?'#ae791c':resource?'#7756bd':'#335cde';
  const muted=selected&&selected!==node.id&&!related.has(node.id);
  return h('g',{key:node.id,transform:`translate(${node.x},${node.y})`,opacity:muted?.35:1,role:'button',tabIndex:0,'aria-label':info.title,onClick:()=>setSelected(selected===node.id?null:node.id),onKeyDown:e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();setSelected(node.id);}},style:{cursor:'pointer'}},
   h('rect',{x:1,y:4,width:node.width,height:node.height,rx:12,fill:'#dce5e9',opacity:.5}),
   h('rect',{width:node.width,height:node.height,rx:12,fill:'#fff',stroke:selected===node.id?color:'#d6e0e6',strokeWidth:selected===node.id?2.5:1}),
   h('rect',{x:0,y:14,width:4,height:node.height-28,rx:2,fill:color}),
   decision?h('path',{d:'M25 17 L31 23 L25 29 L19 23Z',fill:'#fff3d5',stroke:color}):h('circle',{cx:25,cy:23,r:4,fill:color}),
   h('text',{x:39,y:27,fontFamily:'Arial, sans-serif',fontSize:11,fontWeight:700,letterSpacing:1,fill:color},info.kind.toUpperCase()),
   h('text',{x:22,y:54,fontFamily:'Consolas, monospace',fontSize:14,fontWeight:400,fill:'#193447'},info.titleLines.map((line,i)=>h('tspan',{key:i,x:22,dy:i?19:0},line))),
   info.detailLines.length>0&&h('text',{x:22,y:54+info.titleLines.length*19+13,fontFamily:'Consolas, monospace',fontSize:12,fill:'#71818e'},info.detailLines.map((line,i)=>h('tspan',{key:i,x:22,dy:i?16:0},line))),
   h('title',null,info.title+'\n'+info.detail));
 }))),
 h('div',{className:'diagram-footnote'},'Select a node to focus its relationships and inspect full text. Scroll to explore; use Fit width to reset.'),
 chosen&&h('div',{className:'diagram-inspector'},h('span',{className:'badge'},chosen.kind),h('h3',null,chosen.title),h('pre',null,chosen.detail||'No additional source details.'),h('button',{className:'secondary',onClick:()=>setSelected(null)},'Clear selection')));
}
export function BusinessDiagram({flow}){
 if(!flow)return h('p',null,'No flow evidence available.');
 const nodes=flow.nodes.map(n=>diagramNode('n'+n.id,n.label,n.decision?'Decision':n.terminal?'End':n.supported?'Operation':'Needs review',n.ref));
 const connections=flow.uncertain?[]:flow.connections?flow.connections.map(e=>({from:'n'+e.from,to:'n'+e.to,label:e.label})):edges(flow).map(([a,b,label])=>({from:'n'+a,to:'n'+b,label}));
 return h(Graph,{title:flow.name+' · business flow',nodes,connections,notice:flow.uncertain?(flow.limitations?.join(' ')||'Partial source map. Control flow requires review before connections can be shown.'):flow.origin==='OpenAI'?'AI interpretation: validate business behavior against the cited source.':null});
}
export function SystemMap({report,plan}){
 const nodes=[],connections=[],resources=new Map();
 const items=plan?plan.modules:report.programs;
 items.forEach((item,index)=>{
  nodes.push(diagramNode('p'+index,item.name,plan?'Capability':'Program',plan?item.responsibility:item.file));
  const references=plan?item.adapters:item.data.map(d=>d.value);
  for(const reference of new Set(references)){
   if(!resources.has(reference)){
    const id='r'+resources.size;resources.set(reference,id);
    nodes.push(diagramNode(id,reference,plan?'Adapter':'Data resource'));
   }
   connections.push({from:'p'+index,to:resources.get(reference),label:plan?'uses':'accesses',proposed:!!plan});
  }
 });
 if(!plan)report.programs.forEach((program,index)=>{
  for(const call of program.calls){
   const target=call.kind==='static call'?report.programs.findIndex(p=>p.name.toUpperCase()===call.value.toUpperCase()):-1;
   let targetId='p'+target;
   if(target<0){
    const key='external:'+call.value;
    if(!resources.has(key)){const id='r'+resources.size;resources.set(key,id);nodes.push(diagramNode(id,call.value,'Unresolved call',call.ref));}
    targetId=resources.get(key);
   }
   if(!connections.some(c=>c.from==='p'+index&&c.to===targetId&&c.label==='calls'))connections.push({from:'p'+index,to:targetId,label:'calls'});
  }
 });
 return h(Graph,{title:plan?'Proposed capability architecture':'Current system dependencies',nodes,connections,direction:'RIGHT'});
}
