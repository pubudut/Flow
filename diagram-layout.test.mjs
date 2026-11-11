import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {wrapLabel,diagramNode,graphOptions} from './diagram-layout.js';
const runtimeModule=new (createRequire(import.meta.url)('node:module'))('elk.cjs');
runtimeModule._compile(readFileSync('vendor/elk.js','utf8'),'elk.cjs');
const engine=new runtimeModule.exports();
test('long labels and paths remain bounded inside cards',()=>{
 const label='C:/very-long-repository-name/'.repeat(12);
 assert.ok(wrapLabel(label,34,4).every(line=>line.length<=34));
 const node=diagramNode('a',label,'Program',label);
 assert.equal(node.titleLines.length,4);
 const textBottom=54+node.titleLines.length*19+13+(node.detailLines.length-1)*16;
 assert.ok(textBottom<node.height-12);
});
test('dense cyclic graphs have distinct node rectangles and routed edges',async()=>{
 const children=Array.from({length:12},(_,i)=>diagramNode('n'+i,'Program '+i+' with lengthy responsibility '.repeat(3),'Program','src/long/path.cbl'));
 const edges=children.flatMap((n,i)=>[1,3].map(offset=>({id:i+'-'+offset,sources:[n.id],targets:['n'+((i+offset)%children.length)],labels:[{text:'calls',width:60,height:26}]})));
 const graph=await engine.layout({id:'root',layoutOptions:graphOptions('RIGHT'),children,edges});
 for(let i=0;i<graph.children.length;i++)for(let j=i+1;j<graph.children.length;j++){
  const a=graph.children[i],b=graph.children[j];
  assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'Overlapping nodes');
 }
 assert.ok(graph.edges.every(edge=>edge.sections?.length));
});
