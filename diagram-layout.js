// Fixed-width text metrics keep exported SVG geometry identical across browsers.
export function wrapLabel(text, columns=36, maxLines=5) {
  const lines=[];
  for(const paragraph of String(text||'').split(/\r?\n/)){
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      let remaining=word;
      if(line&&line.length+remaining.length+1>columns){lines.push(line);line='';}
      while(remaining.length>columns){
        if(line){lines.push(line);line='';}
        lines.push(remaining.slice(0,columns));remaining=remaining.slice(columns);
      }
      line=line?line+' '+remaining:remaining;
    }
    if(line)lines.push(line);
  }
  if(lines.length>maxLines)return [...lines.slice(0,maxLines-1),lines[maxLines-1].slice(0,columns-1)+'…'];
  return lines;
}
export function diagramNode(id,title,kind,detail=''){
  const titleLines=wrapLabel(title,34,4),detailLines=wrapLabel(detail,38,3);
  return {id,title,kind,detail,titleLines,detailLines,width:340,
    height:62+titleLines.length*19+(detailLines.length?16+detailLines.length*16:0)};
}
export function graphOptions(direction){
 return {'elk.algorithm':'layered','elk.direction':direction,
 'elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':'64',
 'elk.layered.spacing.nodeNodeBetweenLayers':'100',
 'elk.layered.spacing.edgeNodeBetweenLayers':'32',
 'elk.spacing.edgeEdge':'24','elk.padding':'[top=36,left=36,bottom=36,right=36]',
 'elk.layered.nodePlacement.strategy':'NETWORK_SIMPLEX'};
}
