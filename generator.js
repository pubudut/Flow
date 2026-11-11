import {translationReport,ruleJava,ruleController} from './translator.js';
// Approval binds the exact source, analysis, proposal and review notes.
export function reviewSnapshot(files, report, plan, notes) {
  return JSON.stringify({files, report, plan, notes});
}
export async function approveSnapshot(snapshot) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
  return {snapshot, sha256: [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join(''), approvedAt:new Date().toISOString()};
}
export function isApproved(snapshot, approval) {
  return !!approval && approval.snapshot === snapshot;
}
export function generateProject(snapshot, approval) {
  if (!isApproved(snapshot, approval)) throw Error('Approve the current architecture before generation.');
  const {files:sourceFiles, report, plan, notes} = JSON.parse(snapshot);
  if(!plan || !report.flows.length) throw Error('No approved flows to generate.');
  const translation=translationReport(sourceFiles,report);
  if(translation.blocked.length)throw Error('Resolve unsupported flows before generation: '+translation.blocked.map(b=>b.id+' — '+b.reason).join('; '));
  if(!translation.supported.length)throw Error('No executable rules available.');
  const projects = plan.style === 'Candidate service boundaries'
    ? plan.modules.map((module,index)=>({folder:'service-'+(index+1), modules:[module]}))
    : [{folder:'application',modules:plan.modules}];
  const files = {
    'review/architecture.json': JSON.stringify(plan,null,2),
    'review/business-flows.json':JSON.stringify(report,null,2),
    'review/approval.json':JSON.stringify({sha256:approval.sha256,approvedAt:approval.approvedAt,notes},null,2),
    'review/approved-snapshot.json':snapshot,
    'README.md':'# Approved migration project\n\nGenerated executable Spring Boot numeric rules with Java 21 and Maven.\nRun mvn spring-boot:run inside an application/service folder.\nGET /api/modules lists the generated module catalog.\nGET /actuator/health reports service health.\n\nPOST /api/rules/evaluate with ruleId and fields (decimal strings). See rule-contracts.json for input names. Numeric outputs are decimal strings. Validate against legacy execution before production.\nSeparate services default to port 8080; use --server.port to run them together.\n\nReview evidence and approval fingerprint are in review/.\n'
  };
  for(const project of projects){
    const prefix=project.folder+'/';
    files[prefix+'pom.xml']=`<project xmlns="http://maven.apache.org/POM/4.0.0">
<modelVersion>4.0.0</modelVersion>
<parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.5.16</version></parent>
<groupId>local.migration</groupId><artifactId>${project.folder}</artifactId><version>1.0.0</version>
<properties><java.version>21</java.version></properties>
<dependencies>
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
</dependencies>
<build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>
</project>`;
    const java=prefix+'src/main/java/local/migration/';
    const rules=translation.supported.filter(rule=>project.modules.some(module=>(module.sources||[module.source]).some(source=>rule.id.startsWith(source+':'))));
    files[java+'RuleEngine.java']=ruleJava(rules);
    files[java+'RuleController.java']=ruleController;
    files[prefix+'rule-contracts.json']=JSON.stringify(rules.map((rule,index)=>({ruleId:'rule'+(index+1),source:rule.id,inputs:rule.inputs,outputs:rule.outputs,fields:rule.fields})),null,2);
    files[java+'MigrationApplication.java']=`package local.migration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class MigrationApplication {
    public static void main(String[] args) {
        SpringApplication.run(MigrationApplication.class, args);
    }
}
`;
    files[java+'ModuleCatalogController.java']=`package local.migration;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
class ModuleCatalogController {
    @GetMapping("/api/modules")
    List<String> modules() {
        return List.of(${project.modules.map((_,i)=>'"module'+(i+1)+'"').join(', ')});
    }
}
`;
    project.modules.forEach((module,i)=>{
      const name='module'+(i+1);
      files[java+name+'/BusinessOperation.java']=`package local.migration.${name};
import java.math.BigDecimal;
import java.util.Map;
/** Domain port. Implement from reviewed source evidence and parity tests. */
public interface BusinessOperation {
    Map<String, BigDecimal> execute(Map<String, BigDecimal> inputs);
}
`;
      files[prefix+'module-evidence/'+name+'.json']=JSON.stringify(module,null,2);
    });
    files[prefix+'src/main/resources/application.properties']='server.address=127.0.0.1\nmanagement.endpoint.health.probes.enabled=true\n';
    files[prefix+'.gitignore']='target/\n';
  }
  return files;
}
// ZIP STORE format, UTF-8 filenames and CRC32. No executable dependency required.
export function zipFiles(files) {
  const encoder=new TextEncoder(),chunks=[],central=[];
  let offset=0;
  const crc32=bytes=>{
    let crc=0xffffffff;
    for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    return (crc^0xffffffff)>>>0;
  };
  for(const [path,text] of Object.entries(files)){
    const name=encoder.encode(path),data=encoder.encode(text),crc=crc32(data);
    const header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);
    view.setUint16(12,33,true);view.setUint32(14,crc,true);
    view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,name.length,true);header.set(name,30);
    const entry=new Uint8Array(46+name.length),cv=new DataView(entry.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);
    cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
    cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);entry.set(name,46);
    chunks.push(header,data);central.push(entry);offset+=header.length+data.length;
  }
  const centralSize=central.reduce((size,entry)=>size+entry.length,0);
  const end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);
  ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}
