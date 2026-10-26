import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const start=html.indexOf('function isCurrentChat(');
const end=html.indexOf('async function history()',start);
assert.ok(start>0&&end>start,'production chat session helpers exist');
const helpers=html.slice(start,end);

test('sign-out clears chat content, drafts, export source and owner state',()=>{
 const ids=['messages','question','attach-input','file-list','file-status','result-status','context','print-report','quick-actions','external','to-tasks','retry','login-note','case-title','core-status'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{textContent:'private',value:'private',href:'private',classList:{add(){},remove(){}}}]));
 const ctx={sessionEpoch:0,user:{id:'owner-A'},caseData:{id:'case-A'},lastAnswer:'private answer',pendingFiles:['file'],working:true,
  exhaustedRetryMessages:new Set(),latestUserMessageId:null,
  $:id=>nodes[id],setStatus(){},error(){},waiting(v){ctx.working=v}};
 runInNewContext(helpers,ctx);
 assert.equal(ctx.isCurrentChat(0,'owner-A'),true);
 ctx.resetChatSession();
 assert.equal(ctx.sessionEpoch,1);
 assert.equal(ctx.user,null);
 assert.equal(ctx.caseData,null);
 assert.equal(ctx.lastAnswer,'');
 assert.equal(ctx.pendingFiles.length,0);
 assert.equal(ctx.working,false);
 assert.equal(ctx.isCurrentChat(0,'owner-A'),false);
 for(const id of ['messages','file-list','file-status','result-status','context','print-report','quick-actions'])assert.equal(nodes[id].textContent,'',id);
 assert.equal(nodes['core-status'].textContent,'Нужен вход для проверки серверной методики.');
 for(const id of ['question','attach-input'])assert.equal(nodes[id].value,'',id);
 assert.equal(nodes.external.href,'https://chatgpt.com/');
});

test('in-flight history, AI and upload paths verify current session',()=>{
 assert.match(html,/db\.auth\.onAuthStateChange\(/);
 assert.match(html,/event==='SIGNED_OUT'/);
 const history=html.slice(html.indexOf('async function history()'),html.indexOf('async function requestAI()'));
 assert.ok((history.match(/isCurrentChat\(epoch,ownerId\)/g)||[]).length>=3);
 const ai=html.slice(html.indexOf('async function requestAI()'),html.indexOf('const allowedFiles='));
 assert.ok((ai.match(/isCurrentChat\(epoch,ownerId\)/g)||[]).length>=4);
 const send=html.slice(html.indexOf('async function send()'),html.indexOf('const quickOptions='));
 assert.ok((send.match(/isCurrentChat\(epoch,ownerId\)/g)||[]).length>=5);
});

test('delayed history cannot restore old-owner messages after sign-out',async()=>{
 const nodes=Object.fromEntries(['messages','question','attach-input','file-list','file-status','result-status','context','print-report','quick-actions','external','to-tasks','retry','login-note','case-title','core-status']
  .map(id=>[id,{textContent:'private',value:'private',href:'private',classList:{add(){},remove(){}}}]));
 let resolveQuery;
 const delayed=new Promise(resolve=>{resolveQuery=resolve});
 const db={from(){return {select(){return this},eq(){return this},order(){return this},limit(){return delayed}}}};
 const ctx={sessionEpoch:0,user:{id:'owner-A'},caseData:{id:'case-A'},lastAnswer:'previous answer',pendingFiles:[],working:false,db,caseId:'case-A',
  exhaustedRetryMessages:new Set(),latestUserMessageId:null,
  $:id=>nodes[id],setStatus(){},error(){},waiting(v){ctx.working=v}};
 const historyEnd=html.indexOf('async function requestAI()',end);
 runInNewContext(helpers+'\n'+html.slice(end,historyEnd),ctx);
 const pending=ctx.history();
 ctx.resetChatSession();
 resolveQuery({data:[{id:'old-message',role:'assistant',content:'PRIVATE OLD MESSAGE'}],error:null});
 await pending;
 assert.equal(ctx.lastAnswer,'');
 assert.equal(nodes.messages.textContent,'');
 assert.equal(ctx.caseData,null);
});

test('core status waits for verified owner case and identifies a server-side skill copy',async()=>{
 const core=html.slice(html.indexOf('async function checkCoreIntegrity()'),html.indexOf('async function init()'));
 const init=html.slice(html.indexOf('async function init()'),html.indexOf("$('add-file').addEventListener",html.indexOf('async function init()')));
 assert.ok(init.indexOf('void checkCoreIntegrity();')>init.indexOf('caseData=data;'),'Core check must run after case ownership is verified');
 let calls=0;
 const node={textContent:'Ожидание'};
 const ctx={db:{functions:{invoke:async()=>{calls++;return {data:{service:'Advisor AI Workspace',core_version:'2.2.0',skill_sha256:'a'.repeat(64),shared_methods:['bond_current_yield']},error:null}}}},
  user:null,caseData:null,sessionEpoch:0,$:()=>node};
 ctx.isCurrentChat=(epoch,owner)=>epoch===ctx.sessionEpoch&&!!ctx.caseData&&ctx.user?.id===owner;
 runInNewContext(core,ctx);
 await ctx.checkCoreIntegrity();
 assert.equal(calls,0,'Do not query a JWT-protected function before authentication');
 ctx.user={id:'synthetic-owner'};ctx.caseData={id:'synthetic-case'};
 await ctx.checkCoreIntegrity();
 assert.equal(calls,1);
 assert.match(node.textContent,/Серверная копия методики Advisor AI 2\.2\.0/);
 assert.match(node.textContent,/не проверка текущей версии приватного ChatGPT-плагина/);
});

test('late core status response cannot overwrite a signed-out session',async()=>{
 const core=html.slice(html.indexOf('async function checkCoreIntegrity()'),html.indexOf('async function init()'));
 let resolveResponse;
 const delayed=new Promise(resolve=>{resolveResponse=resolve});
 const node={textContent:'Ожидание'};
 const ctx={db:{functions:{invoke:()=>delayed}},user:{id:'synthetic-owner'},caseData:{id:'synthetic-case'},sessionEpoch:0,$:()=>node};
 ctx.isCurrentChat=(epoch,owner)=>epoch===ctx.sessionEpoch&&!!ctx.caseData&&ctx.user?.id===owner;
 runInNewContext(core,ctx);
 const pending=ctx.checkCoreIntegrity();
 ctx.sessionEpoch++;ctx.user=null;ctx.caseData=null;
 resolveResponse({data:{service:'Advisor AI Workspace',core_version:'2.2.0',skill_sha256:'a'.repeat(64),shared_methods:[]},error:null});
 await pending;
 assert.equal(node.textContent,'Ожидание');
});
