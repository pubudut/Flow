import test from 'node:test';
import assert from 'node:assert/strict';
import {createCopilotProvider} from './copilot-backend.mjs';
import {createAIService} from './ai-backend.mjs';

test('Copilot uses isolated, tool-free sessions and removes sessions after output',async()=>{
 let options,config,sent,deleted;
 const p=createCopilotProvider({clientFactory:async o=>{options=o;return {start:async()=>{},getAuthStatus:async()=>({isAuthenticated:true}),createSession:async c=>{config=c;return {sessionId:'test',sendAndWait:async s=>{sent=s;return {data:{content:'{"message":"Connected"}'}};},disconnect:async()=>{}};},deleteSession:async id=>{deleted=id;},stop:async()=>{}};}});
 const service=createAIService({provider:'copilot',copilot:p});
 assert.equal((await service.status()).configured,true);
 assert.match((await service.test()).message,/GitHub Copilot/);
 assert.equal(options.mode,'empty');assert.equal(options.env.OPENAI_API_KEY,undefined);
 assert.deepEqual(config.availableTools,[]);assert.equal(config.enableConfigDiscovery,false);assert.equal(config.enableSkills,false);
 assert.equal(config.onPermissionRequest().kind,'denied-interactively-by-user');
 assert.equal(sent.responseSchema.type,'object');assert.equal(deleted,'test');await p.close();
});
test('Copilot malformed output and unauthenticated requests fail without OpenAI fallback',async()=>{
 const service=createAIService({provider:'copilot',copilot:{invoke:async()=>({unexpected:'bad'})}});
 await assert.rejects(service.test(),/Invalid AI response structure/);
 let created=false;
 const p=createCopilotProvider({clientFactory:async()=>({start:async()=>{},getAuthStatus:async()=>({isAuthenticated:false}),createSession:async()=>{created=true;}})});
 await assert.rejects(p.invoke({schema:{},input:{}}),/Sign in/);assert.equal(created,false);
});
test('Copilot device sign-in exposes only the one-time code and public GitHub URL',async()=>{
 let finish;
 const p=createCopilotProvider({clientFactory:async()=>({start:async()=>{},getAuthStatus:async()=>({isAuthenticated:false}),deleteSession:async()=>{},createSession:async()=>({sessionId:'auth',disconnect:async()=>{},rpc:{accounts:{login:{begin:async()=>({flowId:'private-id',step:{kind:'device-code',userCode:'TEST-CODE',verificationUri:'https://github.com/login/device',expiresIn:600}}),advance:()=>new Promise(resolve=>{finish=resolve;})}}}})})});
 const result=await p.connect();assert.deepEqual(Object.keys(result),['userCode','verificationUri','expiresIn']);
 assert.equal((await p.status()).loginPending,true);finish({kind:'completed',result:{status:'completed'}});
});

test('unfinished credential storage never reports connected or cancels the login',async()=>{
 let finish,cancelled=false,cleaned=false,auth=true;
 const p=createCopilotProvider({clientFactory:async()=>({start:async()=>{},getAuthStatus:async()=>({isAuthenticated:auth}),deleteSession:async()=>{cleaned=true;},createSession:async()=>({sessionId:'auth',disconnect:async()=>{},rpc:{accounts:{login:{begin:async()=>({flowId:'id',step:{kind:'device-code',userCode:'CODE',verificationUri:'https://github.com/login/device',expiresIn:600}}),advance:()=>new Promise(resolve=>{finish=resolve;}),cancel:async()=>{cancelled=true;}}}}})})});
 await p.connect();assert.equal((await p.status()).configured,false);
 finish({kind:'completed',result:{status:'needs-plaintext-consent'}});
 await new Promise(resolve=>setImmediate(resolve));
 const state=await p.status();assert.equal(state.configured,false);assert.equal(state.loginStep.kind,'storage-consent');assert.equal(cancelled,false);assert.equal(cleaned,false);
 await assert.rejects(p.finishLogin({}),/Choose/);
 const pending=p.finishLogin({storageConsent:false});finish({kind:'completed',result:{status:'declined'}});await pending;
 assert.equal(cancelled,true);assert.equal(cleaned,true);assert.equal((await p.status()).configured,false);
});

test('account selection preserves authorization until a valid choice completes',async()=>{
 let finish,cleaned=false;
 const p=createCopilotProvider({clientFactory:async()=>({start:async()=>{},getAuthStatus:async()=>({isAuthenticated:true}),deleteSession:async()=>{cleaned=true;},createSession:async()=>({sessionId:'auth',disconnect:async()=>{},rpc:{accounts:{login:{begin:async()=>({flowId:'id',step:{kind:'device-code',userCode:'CODE',verificationUri:'https://github.com/login/device',expiresIn:600}}),advance:()=>new Promise(resolve=>{finish=resolve;})}}}})})});
 await p.connect();finish({kind:'completed',result:{status:'needs-account-selection',accounts:[{selectionId:'choice',login:'example',host:'https://github.com'}]}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await p.status()).configured,false);assert.equal(cleaned,false);
 await assert.rejects(p.finishLogin({selectionId:'not-offered'}),/Select/);
 const pending=p.finishLogin({selectionId:'choice'});finish({kind:'completed',result:{status:'completed'}});await pending;
 assert.equal((await p.status()).configured,true);assert.equal(cleaned,true);
});

test('allow storage saves the SDK setting and passes a boolean-text decision',async()=>{
 let finish,advanceInput,settings;
 const p=createCopilotProvider({clientFactory:async()=>({start:async()=>{},getAuthStatus:async()=>({isAuthenticated:true}),rpc:{user:{settings:{set:async p=>{settings=p.settings;}}}},deleteSession:async()=>{},createSession:async()=>({sessionId:'auth',disconnect:async()=>{},rpc:{accounts:{login:{begin:async()=>({flowId:'id',step:{kind:'device-code',userCode:'CODE',verificationUri:'https://github.com/login/device',expiresIn:600}}),advance:args=>{advanceInput=args.input;return new Promise(resolve=>{finish=resolve;});}}}}})})});
 await p.connect();finish({kind:'completed',result:{status:'needs-plaintext-consent'}});await new Promise(resolve=>setImmediate(resolve));
 const pending=p.finishLogin({storageConsent:true});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(settings,{storeTokenPlaintext:true});assert.equal(advanceInput,'true');finish({kind:'completed',result:{status:'completed'}});await pending;assert.equal((await p.status()).configured,true);
});
