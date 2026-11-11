// Numeric expressions are parsed into BigDecimal calls; source is never Java code.
export function compileProgram(file, flow, format) {
  if(flow.uncertain)throw Error('Control flow requires manual resolution.');
  const fields=new Map();
  for(const raw of file.text.split(/\r?\n/)){
    if(format==='fixed'&&['*','/'].includes(raw[6]))continue;
    const line=(format==='fixed'?raw.slice(7,72):raw).trim().toUpperCase();
    const declaration=line.match(/^01\s+([A-Z][A-Z0-9-]*)\s+PIC\s+(S)?9\(([0-9]+)\)(?:V(9+))?\.$/);
    if(declaration){
      const digits=Number(declaration[3]),scale=(declaration[4]||'').length;
      if(digits+scale>31||digits<1)throw Error('Unsupported numeric precision.');
      fields.set(declaration[1],{digits,scale,signed:!!declaration[2]});
    }else if(/^(\d{2}|COPY|REPLACE|EXEC)\b/.test(line))throw Error('Unsupported declaration or external operation: '+line);
  }
  if(!fields.size)throw Error('Explicit numeric PIC declarations are required.');
  const reads=new Set(),writes=new Set();
  function expr(source){
    const tokens=source.toUpperCase().match(/[A-Z][A-Z0-9-]*|[0-9]+(?:\.[0-9]+)?|[()+*\-]/g)||[];
    if(tokens.join('')!==source.toUpperCase().replace(/\s/g,''))throw Error('Unsupported expression: '+source);
    let index=0;
    function atom(){
      const token=tokens[index++];
      if(token==='('){const value=sum();if(tokens[index++]!==')')throw Error('Unclosed expression');return value;}
      if(token==='-'||token==='+'){const value=atom();return token==='-'?value+'.negate()':value;}
      if(/^[0-9]/.test(token||''))return 'new BigDecimal("'+token+'")';
      if(!fields.has(token))throw Error('Unknown numeric field: '+token);
      reads.add(token);return 'values.get("'+token+'")';
    }
    function product(){let value=atom();while(tokens[index]==='*'){index++;value+=' .multiply('+atom()+')';}return value;}
    function sum(){let value=product();while(['+','-'].includes(tokens[index])){const op=tokens[index++];value+='.'+(op==='+'?'add':'subtract')+'('+product()+')';}return value;}
    const value=sum();if(index!==tokens.length)throw Error('Unsupported expression: '+source);return value;
  }
  function block(nodes){
    return nodes.map(node=>{
      const line=node.label.toUpperCase();
      if(node.decision){
        const condition=line.match(/^IF\s+(.+?)\s+(>=|<=|<>|=|>|<)\s+(.+)$/);
        if(!condition)throw Error('Unsupported IF');
        const op={'=':'==','<>':'!='}[condition[2]]||condition[2];
        return 'if ('+expr(condition[1])+'.compareTo('+expr(condition[3])+') '+op+' 0) {\n'+block(node.yes)+'\n} else {\n'+block(node.no)+'\n}';
      }
      if(/^(GOBACK|STOP RUN)\.?$/.test(line)){
        if(node.id!==flow.nodes.at(-1).id||node.depth!==0)throw Error('Only a final top-level return is supported.');
        return '';
      }
      const compute=line.match(/^COMPUTE ([A-Z][A-Z0-9-]*)( ROUNDED)? = (.+)$/);
      const move=line.match(/^MOVE (.+) TO ([A-Z][A-Z0-9-]*)$/);
      if(!compute&&!move)throw Error('Unsupported statement: '+node.label);
      const target=compute?compute[1]:move[2],source=compute?compute[3]:move[1],rounded=!!compute?.[2];
      if(!fields.has(target))throw Error('Unknown output field: '+target);
      writes.add(target);
      const field=fields.get(target);
      return 'values.put("'+target+'", store('+expr(source)+', '+field.digits+', '+field.scale+', '+field.signed+', RoundingMode.'+(rounded?'HALF_UP':'DOWN')+'));';
    }).join('\n');
  }
  const code=block(flow.tree);
  // Outputs must be initialized unconditionally before branches to avoid invented state.
  const initialized=new Set();
  for(const node of flow.tree){
    const init=node.label.match(/^MOVE ([+-]?[0-9]+(?:\.[0-9]+)?) TO ([A-Z][A-Z0-9-]*)$/i);
    if(!init)break;
    initialized.add(init[2].toUpperCase());
  }
  for(const field of writes)if(!initialized.has(field))throw Error('Initialize output '+field+' with a numeric MOVE at paragraph entry.');
  const inputs=[...reads].filter(name=>!writes.has(name));
  return {id:flow.file+':'+flow.name,fields:Object.fromEntries(fields),inputs,outputs:[...writes],code};
}
export function translationReport(files,report){
  const supported=[],blocked=[];
  for(const flow of report.flows){
    try{
      if(report.flows.filter(f=>f.file===flow.file).length!==1)throw Error('Multiple paragraphs require orchestration support.');
      const file=files.find(f=>f.name===flow.file);
      supported.push(compileProgram(file,flow,report.format||'fixed'));
    }catch(error){blocked.push({id:flow.file+':'+flow.name,reason:error.message});}
  }
  return {supported,blocked};
}
export function ruleJava(rules){
  const cases=rules.map((rule,index)=>{
    const init=Object.entries(rule.fields).map(([name,field])=>'values.put("'+name+'", '+(rule.inputs.includes(name)?'store(parse(input.get("'+name+'")), '+field.digits+', '+field.scale+', '+field.signed+', RoundingMode.UNNECESSARY)':'BigDecimal.ZERO')+');').join('\n');
    const output=rule.outputs.map(name=>'result.put("'+name+'", values.get("'+name+'").toPlainString());').join('\n');
    return 'case "rule'+(index+1)+'": {\nMap<String, BigDecimal> values = new HashMap<>();\n'+init+'\n'+rule.code+'\nMap<String,String> result=new LinkedHashMap<>();\n'+output+'\nreturn result;\n}';
  }).join('\n');
  return `package local.migration;
import java.math.*;
import java.util.*;
public final class RuleEngine {
    private RuleEngine() {}
    static BigDecimal parse(String value) {
        if(value==null || value.length()>128 || !value.matches("[+-]?[0-9]+(\\\\.[0-9]+)?"))
            throw new IllegalArgumentException("Provide decimal strings for all required inputs");
        return new BigDecimal(value);
    }
    static BigDecimal store(BigDecimal value,int digits,int scale,boolean signed,RoundingMode mode) {
        value=value.setScale(scale,mode);
        if((!signed && value.signum()<0)||value.abs().compareTo(BigDecimal.TEN.pow(digits))>=0)
            throw new IllegalArgumentException("Numeric storage overflow");
        return value;
    }
    public static Map<String,String> evaluate(String id,Map<String,String> input) {
        if(id==null||input==null)throw new IllegalArgumentException("Provide ruleId and fields");
        switch(id) {
${cases}
            default: throw new NoSuchElementException("Unknown rule");
        }
    }
}`;
}
export const ruleController=`package local.migration;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
class RuleController {
    record Input(String ruleId, Map<String,String> fields) {}
    @PostMapping("/api/rules/evaluate")
    Map<String,String> evaluate(@RequestBody Input input) {
        try {return RuleEngine.evaluate(input.ruleId(),input.fields());}
        catch(NoSuchElementException error){throw new ResponseStatusException(HttpStatus.NOT_FOUND,error.getMessage());}
        catch(IllegalArgumentException | ArithmeticException error){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,error.getMessage());}
    }
}`;
