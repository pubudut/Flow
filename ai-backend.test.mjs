import test from 'node:test';
import assert from 'node:assert/strict';
import {createAIService,validateProject,callOpenAI,designSchema} from './ai-backend.mjs';
import {createServer} from './server.mjs';
import {sampleIdea} from './idea-design.js';
import {sample} from './analyzer.js';
import {reviewSnapshot} from './generator.js';
const project={summary:'Test project',limitations:['Mock output; not a model-generated application.'],files:[{path:'pom.xml',content:'<project/>'},{path:'README.md',content:'Test fixture'},{path:'Dockerfile',content:'FROM eclipse-temurin:21'},{path:'src/main/java/App.java',content:'class App {}'},{path:'src/test/java/AppTest.java',content:'class AppTest {}'}]};
function mocked({mutate=x=>x,status=200}={}){
 const requests=[];
 return {requests,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);requests.push({url,...body});const input=JSON.parse(body.input);
  let result=project;
  if(input.proposal){const p=input.proposal;result={summary:'AI design interpretation',decisions:['Preserve business invariants.'],risks:['Validate runtime behavior.'],modules:p.modules.map(({name,responsibility,reason,sources,source,adapters})=>({name,responsibility,reason,sources:sources||[source],adapters})),findings:p.assessment.findings.map(f=>({id:f.id,action:f.action,tradeoff:f.tradeoff,when:f.when||'',evidenceRefs:[Object.keys(input.evidence)[0]]})),flows:input.mode==='legacy'?[{name:'Calculate customer price',sources:[input.files[0].name],limitations:[],nodes:[{id:'start',label:'Calculate the order price',kind:'operation',evidenceRefs:[Object.keys(input.evidence)[0]]},{id:'done',label:'Return the final amount',kind:'end',evidenceRefs:[Object.keys(input.evidence)[0]]}],edges:[{from:'start',to:'done',label:'Result'}]}]:[],businessRules:[{name:'Pricing',description:'Nested condition and decimal calculation',evidenceRefs:[Object.keys(input.evidence)[0]]}]};}
  return {ok:status===200,status,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(mutate(result))}]}]})};
 }};
}
test('both AI workflows bind reviewed source to backend approval before generation',async()=>{
 for(const provider of ['openai','copilot']) for(const mode of ['idea','legacy']){
  const mock=mocked(),service=createAIService({provider,apiKey:'test-key',fetchImpl:mock.fetchImpl,copilot:{invoke:args=>callOpenAI({apiKey:'fixture',model:'fixture',fetchImpl:mock.fetchImpl,...args})}});
  const payload=mode==='idea'?{mode,input:sampleIdea,consent:true}:{mode,files:sample,format:'fixed',deployment:'modular',consent:true};
  await assert.rejects(service.analyze({...payload,consent:false}),/Confirm/);
  const design=await service.analyze(payload),files=mode==='idea'?[]:sample;
  if(mode==='legacy'){assert.equal(design.report.flows[0].origin,provider==='copilot'?'GitHub Copilot':'OpenAI');assert.equal(design.report.flows[0].name,'Calculate customer price');assert.equal(design.report.flows[0].connections.length,1);assert.ok(design.report.staticFlows.length);}
  assert.ok(design.plan.ai.analysisId);assert.ok(design.report.aiBusinessRules[0].evidence.length);
  assert.throws(()=>service.approve({snapshot:reviewSnapshot(files,design.report,design.plan,'')}),/Complete design/);
  design.plan.assessment.findings.forEach(f=>f.decision='Accept recommendation');
  const snapshot=reviewSnapshot(files,design.report,design.plan,'Reviewed');
  await assert.rejects(service.generate({snapshot,consent:true}),/Approve/);
  const approval=service.approve({snapshot});
  await assert.rejects(service.generate({snapshot:snapshot+' ',token:approval.token,consent:true}),/Approve/);
  const output=await service.generate({snapshot,token:approval.token,consent:true});assert.ok(output.files['pom.xml']);assert.ok(output.files['flow-review/approval.json']);
  assert.equal(mock.requests[0].store,false);assert.equal(mock.requests[0].text.format.strict,true);assert.equal(mock.requests.length,2);
  const tampered=JSON.parse(snapshot);tampered.report.name='changed';assert.throws(()=>service.approve({snapshot:JSON.stringify(tampered)}),/source changed/);
  const missing=JSON.parse(snapshot);missing.plan.assessment.findings=[];assert.throws(()=>service.approve({snapshot:JSON.stringify(missing)}),/every required/);
 }
});
test('AI output rejects fabricated evidence, missing assessments and unsafe file paths',async()=>{
 for(const mutate of [r=>({...r,findings:r.findings.slice(1)}),r=>({...r,businessRules:[{name:'fake',description:'fake',evidenceRefs:['invented:999']}]}),r=>({...r,modules:[]})]){
  const mock=mocked({mutate}),service=createAIService({apiKey:'test',fetchImpl:mock.fetchImpl});await assert.rejects(service.analyze({mode:'idea',input:sampleIdea,consent:true}));
 }
 for(const path of ['../bad.java','/tmp/bad.java','C:\\bad.java','.env','a/../../bad.java','run.ps1'])assert.throws(()=>validateProject({...project,files:[...project.files,{path,content:'bad'}]}),/unsafe/);
 assert.throws(()=>validateProject({...project,files:project.files.slice(1)}),/missing/);
 await assert.rejects(callOpenAI({apiKey:'',model:'test',schema:designSchema,input:{}}),/not configured/);
 await assert.rejects(createAIService({apiKey:'test',fetchImpl:mocked({status:429}).fetchImpl}).analyze({mode:'idea',input:sampleIdea,consent:true}),/quota/);
});
test('HTTP backend blocks secret/static exposure and cross-origin API actions',async t=>{
 const server=createServer(createAIService({apiKey:'test-secret',fetchImpl:mocked().fetchImpl}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url='http://127.0.0.1:'+server.address().port;
 const status=await (await fetch(url+'/api/ai/status')).json();assert.equal(status.configured,true);assert.ok(!JSON.stringify(status).includes('test-secret'));
 for(const pathname of ['/.env','/.git/config','/ai-backend.mjs','/server.mjs','/server.log','/.tools/settings.xml'])assert.equal((await fetch(url+pathname)).status,404);
 assert.equal((await fetch(url+'/api/ai/analyze',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json','X-Flow-Request':'1'},body:'{}'})).status,403);
 assert.equal((await fetch(url+'/api/ai/analyze',{method:'POST',body:'{}'})).status,403);
 assert.equal((await fetch(url+'/ai-ui.js')).status,200);
 const design=await (await fetch(url+'/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-Flow-Request':'1'},body:JSON.stringify({mode:'idea',input:sampleIdea,consent:true})})).json();assert.ok(design.plan.ai);
});
test('AI business flows reject fabricated references and broken connectors',async()=>{
 for(const mutate of [
  r=>({...r,flows:[]}),
  r=>{r.flows[0].edges[0].to='missing';return r;},
  r=>{r.flows[0].nodes[0].evidenceRefs=['fake.cbl:999'];return r;},
  r=>{r.flows[0].edges=[];return r;}
 ]){
  const service=createAIService({apiKey:'test',fetchImpl:mocked({mutate}).fetchImpl});
  await assert.rejects(service.analyze({mode:'legacy',files:sample,format:'fixed',consent:true}));
 }
});
