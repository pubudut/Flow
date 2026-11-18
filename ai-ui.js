import React,{useEffect,useState} from './vendor/react.js';
import {zipFiles} from './generator.js';
const h=React.createElement;
export async function aiRequest(action,body){
 let response;try{response=await fetch('/api/ai/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Flow-Request':'1'},body:JSON.stringify(body)});}catch{throw Error('Cannot reach the Flow backend. Start node server.mjs and retry.');}
 let data;try{data=await response.json();}catch{throw Error('AI backend is unavailable. Restart Flow with the updated server.mjs.');}
 if(!response.ok)throw Error(data.error||'AI request failed.');return data;
}
export function AIGeneration({snapshot,approval}){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 async function generate(){setBusy(true);setStatus('Generating the approved project with AI…');try{const result=await aiRequest('generate',{snapshot,token:approval.token,consent:true});const url=URL.createObjectURL(zipFiles(result.files)),link=document.createElement('a');link.href=url;link.download='ai-spring-boot-project.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Downloaded AI-generated project. It has not been built or tested. '+result.summary+' Limitations: '+(result.limitations.join('; ')||'Review generated code and run its tests.'));}catch(e){setStatus(e.message);}finally{setBusy(false);}}
 return h('div',{className:'ai-generation'},h('button',{disabled:busy||!approval?.token||approval.snapshot!==snapshot,onClick:generate},busy?'Generating project…':'Generate Spring Boot with AI'),h('p',null,'Requires backend approval of this exact design. Output includes source, tests, Dockerfile and review notes. Flow does not execute generated code.'),status&&h('p',{className:'status',role:'status'},status));
}
export function AIConfiguration(){
 const [config,setConfig]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(''),[login,setLogin]=useState(null),[testResult,setTestResult]=useState('');
 async function connect(){setBusy(true);setError('');try{setLogin(await aiRequest('connect',{}));}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function finishLogin(body){setBusy(true);setError('');try{setConfig(await aiRequest('finishLogin',body));}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function test(){setBusy(true);setError('');setTestResult('');try{setTestResult((await aiRequest('test',{})).message);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function refresh(){setBusy(true);setError('');try{const response=await fetch('/api/ai/status');if(!response.ok)throw Error('Cannot read backend configuration. Start or restart Flow and try again.');setConfig(await response.json());setChecked(new Date().toLocaleTimeString());}catch(e){setConfig(null);setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{refresh();},[]);
 useEffect(()=>{if((!login&&!config?.loginPending)||config?.configured)return;const timer=setInterval(refresh,5000);return()=>clearInterval(timer);},[login,config?.configured,config?.loginPending]);
 return h('section',{className:'panel'},h('span',{className:'badge'},'WORKSPACE SETTINGS'),h('h1',null,'Configuration'),h('p',null,'Manage the backend connection used for architecture analysis and code generation.'),h('h2',null,'AI connection'),
 h('div',{className:'status',role:'status'},busy?'Checking connection…':error||(!config?'Connection status unavailable.':config.message)),
 config&&h('dl',{className:'configuration-details'},h('dt',null,'Provider'),h('dd',null,config.provider),h('dt',null,'Model'),h('dd',null,config.model),h('dt',null,'Last checked'),h('dd',null,checked)),
 h('p',null,'Refresh checks configuration and Copilot sign-in. Test connection sends a small AI request and consumes provider allowance.'),
 h('button',{disabled:busy,onClick:refresh},busy?'Checking…':'Refresh AI connection'),
 h('button',{className:'secondary',disabled:busy||!config?.configured,onClick:test,style:{marginLeft:12}},'Test connection'),
 config?.provider==='GitHub Copilot'&&!config.configured&&h('button',{disabled:busy,onClick:connect,style:{marginLeft:12}},'Sign in to GitHub'),
 config?.loginStep?.kind==='account-selection'&&h('div',{className:'status'},h('p',null,'Select the GitHub account to use with Flow:'),config.loginStep.accounts.map(a=>h('button',{key:a.selectionId,disabled:busy,onClick:()=>finishLogin({selectionId:a.selectionId})},a.login+' — '+a.host))),
 config?.loginStep?.kind==='storage-consent'&&h('div',{className:'warning'},h('p',null,'GitHub authorization succeeded, but the SDK cannot save credentials in the system credential store. It asks to save your GitHub token unencrypted on this computer. Anyone with access to that file could use the token. Allow this only if you accept that risk.'),h('button',{disabled:busy,onClick:()=>finishLogin({storageConsent:true})},'Allow unencrypted storage'),h('button',{disabled:busy,onClick:()=>finishLogin({storageConsent:false})},'Decline')),
 login&&!config?.configured&&!config?.loginStep&&h('div',{className:'status'},h('p',null,'Enter this one-time code on GitHub: '),h('strong',{style:{fontSize:24,letterSpacing:3}},login.userCode),h('p',null,h('a',{href:login.verificationUri,target:'_blank',rel:'noopener noreferrer'},'Open GitHub sign-in')),h('p',null,'Finish authorization in GitHub. This page checks sign-in automatically. If the code expires, click Sign in again.')),
 testResult&&h('p',{role:'status',className:'status'},testResult),
 h('h2',{style:{marginTop:28}},'Server settings'),h('p',null,'Set AI_PROVIDER=copilot for GitHub Copilot, or AI_PROVIDER=openai with OPENAI_API_KEY and OPENAI_MODEL in .env. Restart Flow after changing providers. Copilot uses Auto model selection by default. GitHub credentials are managed by the official SDK; API keys remain on the backend.'),
 h('p',null,'Copilot Free has a limited personal-use allowance. Flow does not enable paid plans or automatically fall back to OpenAI when your allowance runs out.'),
 h('p',null,'Design requests send the entered requirements to the configured AI provider. Legacy AI analysis sends the selected source files. Code generation sends the approved design and its inputs. Provider limits and usage charges may apply.'),
 error&&h('p',{role:'alert',className:'warning'},error));
}
