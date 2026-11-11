import {inspectProgram,designFromEvidence} from './semantic.js';
export const sample=[{name:'orders/pricing.cbl',text:`       IDENTIFICATION DIVISION.
       PROGRAM-ID. ORDER-PRICE.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 ORDER-TOTAL PIC 9(5)V99.
       01 CUSTOMER-YEARS PIC 9(2).
       01 DISCOUNT PIC 9(5)V99.
       01 SHIPPING PIC 9(3)V99.
       01 FINAL-TOTAL PIC 9(6)V99.
       PROCEDURE DIVISION.
       PRICE-ORDER.
           MOVE 0 TO DISCOUNT
           MOVE 0 TO SHIPPING
           MOVE 0 TO FINAL-TOTAL
           IF ORDER-TOTAL >= 100
               IF CUSTOMER-YEARS >= 5
                   COMPUTE DISCOUNT ROUNDED = ORDER-TOTAL * 0.10
               ELSE
                   COMPUTE DISCOUNT ROUNDED = ORDER-TOTAL * 0.05
               END-IF
           ELSE
               MOVE 7.50 TO SHIPPING
           END-IF
           COMPUTE FINAL-TOTAL = ORDER-TOTAL - DISCOUNT + SHIPPING
           GOBACK.
`}];

export function analyze(files,format='fixed'){
  const flows=[],gaps=[],inventory=[],programs=[];
  for(const file of files){
    if(!/\.(cbl|cob|cobol|cpy|cl|clle|rpg|rpgle|dds|sql)$/i.test(file.name)) continue;
    inventory.push(file.name);
    if(!/\.(cbl|cob|cobol)$/i.test(file.name)){gaps.push(file.name+' — inventoried; parser unavailable for this language.');continue;}
    programs.push(inspectProgram(file,format));
    let active=false,flow=null,stack=[];
    const finish=()=>{
      if(!flow)return;
      if(stack.length){flow.uncertain=true;gaps.push(file.name+' — unmatched IF scope.');}
      if(flow.nodes.length)flows.push(flow);
    };
    file.text.split(/\r?\n/).forEach((raw,index)=>{
      if(format==='fixed' && ['*','/'].includes(raw[6]))return;
      let line=(format==='fixed'?raw.slice(7,72):raw).trim();
      if(!line||line.startsWith('*>'))return;
      const ref=file.name+':'+(index+1);
      if(/^PROCEDURE\s+DIVISION/i.test(line)){active=true;return;}
      if(!active)return;
      const paragraph=/^[A-Z0-9-]+(?: SECTION)?\.$/i.test(line)&&! /^(END-|GOBACK\b|CONTINUE\b|EXIT\b)/i.test(line);
      if(!flow||paragraph){
        finish();flow={name:line.endsWith('.')?line.slice(0,-1):'Entry',file:file.name,nodes:[],tree:[],uncertain:false};stack=[];
        if(paragraph)return;
      }
      if(format==='fixed'&&raw[6]&&raw[6]!==' '){flow.uncertain=true;gaps.push(ref+' — continuation/debug syntax needs review.');return;}
      const upper=line.toUpperCase();
      if(upper==='ELSE'){
        if(!stack.length||stack.at(-1).else){flow.uncertain=true;gaps.push(ref+' — unexpected ELSE.');}
        else stack.at(-1).else=true;
        return;
      }
      if(/^END-IF\.?$/.test(upper)){
        if(!stack.length){flow.uncertain=true;gaps.push(ref+' — unmatched END-IF.');}else stack.pop();
        return;
      }
      const decision=/^IF\s+.+\s+(>=|<=|<>|=|>|<)\s+.+$/i.test(line);
      const supported=decision||/^(MOVE|COMPUTE|DISPLAY|GOBACK|STOP RUN)\b/i.test(line);
      if(!supported){flow.uncertain=true;gaps.push(ref+' — '+line+' requires control-flow review.');}
      const node={id:flow.nodes.length,label:line,ref,decision,supported,yes:[],no:[],depth:stack.length,terminal:/^(GOBACK|STOP RUN)\b/i.test(line)};
      flow.nodes.push(node);
      const parent=stack.at(-1);
      (parent?(parent.else?parent.node.no:parent.node.yes):flow.tree).push(node);
      if(decision)stack.push({node,else:false});
      if(line.endsWith('.')&&stack.length){flow.uncertain=true;gaps.push(ref+' — implicit period scope requires review.');stack=[];}
    });
    finish();
  }
  return {flows,gaps,inventory,programs,format};
}
export function edges(flow){
  const result=[];
  function connect(block,next){
    let successor=next;
    for(const node of [...block].reverse()){
      if(node.decision){
        const yes=connect(node.yes,successor),no=connect(node.no,successor);
        if(yes!==null)result.push([node.id,yes,'Yes']);
        if(no!==null)result.push([node.id,no,'No']);
      }else if(successor!==null&&!node.terminal)result.push([node.id,successor,'']);
      successor=node.id;
    }
    return successor;
  }
  connect(flow.tree,null);return result;
}
export function architecture(report,scale){
  return designFromEvidence(report,scale);
}
