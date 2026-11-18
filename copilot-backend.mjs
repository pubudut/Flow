import {mkdir} from 'node:fs/promises';
import path from 'node:path';

// Isolated SDK state; no repository instructions, tools, MCP servers or skills.
export function createCopilotProvider({model=process.env.COPILOT_MODEL||'auto',clientFactory,baseDirectory=path.resolve('tmp/flow-copilot')}={}){
 let clientPromise,login=null;
 async function client(){
  if(!clientPromise)clientPromise=(async()=>{
   await mkdir(baseDirectory,{recursive:true});
   const options={mode:'empty',baseDirectory,workingDirectory:baseDirectory,logLevel:'error',env:{...process.env,OPENAI_API_KEY:undefined},useLoggedInUser:true};
   const c=clientFactory?await clientFactory(options):new (await import('@github/copilot-sdk')).CopilotClient(options);
   await c.start();return c;
  })().catch(()=>{clientPromise=null;throw Error('Cannot start GitHub Copilot. Run npm ci and restart Flow.');});
  return clientPromise;
 }
 async function status(){
  try{const c=await client(),auth=await c.getAuthStatus();return {configured:auth.isAuthenticated&&(!login||login.completed===true),provider:'GitHub Copilot',model,message:login&&!login.completed?(login.error||'Finish GitHub authorization and any account setup below.'):auth.isAuthenticated?'Signed in to GitHub. Use Test connection to check model access.':login?.error||'Sign in to GitHub to connect Copilot.',loginPending:!!login&&!login.done,loginStep:login?.step||null,maxSourceBytes:240000};}
  catch(e){return {configured:false,provider:'GitHub Copilot',model,message:e.message,maxSourceBytes:240000};}
 }
 async function connect(){
  if(login&&!login.done&&Date.now()<login.expires)return login.public;
  const c=await client();let begun,authSession;
  const cleanup=async()=>{if(authSession){await authSession.disconnect().catch(()=>{});await c.deleteSession(authSession.sessionId).catch(()=>{});}};
  try{authSession=await c.createSession({model,availableTools:[],enableConfigDiscovery:false,enableSkills:false,skipCustomInstructions:true,onPermissionRequest:()=>({kind:'denied-interactively-by-user'})});begun=await authSession.rpc.accounts.login.begin({kind:'githubDotCom',method:'device-code'});}catch{await cleanup();throw Error('GitHub sign-in could not start. Check network access and retry.');}
  const s=begun.step;
  if(s.kind!=='device-code'||s.verificationUri!=='https://github.com/login/device'){
   await authSession.rpc.accounts.login.cancel({flowId:begun.flowId});await cleanup();throw Error('GitHub returned an unsupported sign-in flow. No credentials were saved by Flow.');
  }
  const attempt={done:false,expires:Date.now()+s.expiresIn*1000,public:{userCode:s.userCode,verificationUri:s.verificationUri,expiresIn:s.expiresIn}};login=attempt;
  attempt.advance=async input=>{
   if(attempt.advancing)throw Error('GitHub authorization is already in progress.');
   attempt.advancing=true;
   try{
    const step=await authSession.rpc.accounts.login.advance({flowId:begun.flowId,...(input===undefined?{}:{input})});
    if(step.kind==='completed'&&step.result.status==='completed'){
     attempt.completed=true;attempt.done=true;attempt.step=null;await cleanup();
    }else if(step.kind==='completed'&&step.result.status==='needs-account-selection'){
     attempt.step={kind:'account-selection',accounts:(step.result.accounts||[]).map(a=>({selectionId:a.selectionId,login:a.login,host:a.host}))};
    }else if(step.kind==='completed'&&step.result.status==='needs-plaintext-consent'){
     attempt.step={kind:'storage-consent'};
    }else{
     attempt.error=step.kind==='completed'&&step.result.status==='declined'?'Credential storage was declined. Start sign-in again to change this choice.':'GitHub authorization did not complete ('+step.kind+'). Start sign-in again.';attempt.step=null;attempt.done=true;
     await authSession.rpc.accounts.login.cancel({flowId:begun.flowId});await cleanup();
    }
   }catch{attempt.error='GitHub sign-in expired or failed. Try again.';attempt.done=true;await cleanup();}
   finally{attempt.advancing=false;}
  };
  void attempt.advance();
  return attempt.public;
 }
 async function finishLogin({selectionId,storageConsent}={}){
  if(!login||login.done||!login.step)throw Error('No pending GitHub account setup.');
  if(login.step.kind==='account-selection'){
   if(!login.step.accounts.some(a=>a.selectionId===selectionId))throw Error('Select an offered GitHub account.');
   await login.advance(selectionId);
  }else{
   if(typeof storageConsent!=='boolean')throw Error('Choose whether to allow local unencrypted credential storage.');
   if(storageConsent){const c=await client();await c.rpc.user.settings.set({settings:{storeTokenPlaintext:true}});}
   await login.advance(storageConsent?'true':'false');
  }
  return status();
 }
 async function invoke({schema,instructions,input}){
  if(Buffer.byteLength(JSON.stringify(input))>600000)throw Error('AI input exceeds 600 KB. Select a smaller repository.');
  const c=await client();if(!(await status()).configured)throw Error('Sign in to GitHub Copilot in Configuration first.');
  let session;
  try{
   session=await c.createSession({model,availableTools:[],tools:[],mcpServers:{},enableConfigDiscovery:false,enableSkills:false,skipCustomInstructions:true,onPermissionRequest:()=>({kind:'denied-interactively-by-user'}),systemMessage:{mode:'replace',content:instructions+' Return only a JSON object matching this schema, without markdown fences: '+JSON.stringify(schema)},infiniteSessions:{enabled:false}});
   const answer=await session.sendAndWait({prompt:JSON.stringify(input),responseSchema:schema},180000);
   try{return JSON.parse(answer?.data?.content||'');}catch{throw Error('Copilot returned invalid or incomplete JSON. Reduce scope and retry.');}
  }catch(e){
   if(e.message?.startsWith('Copilot returned'))throw e;
   throw Error('Copilot request failed. Check GitHub sign-in, Copilot plan allowance and model access in Configuration. No result was applied.');
  }finally{if(session){await session.disconnect().catch(()=>{});await c.deleteSession(session.sessionId).catch(()=>{});}}
 }
 return {status,connect,finishLogin,invoke,async close(){if(clientPromise)await (await clientPromise).stop();}};
}
