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
 const ids=['messages','question','attach-input','file-list','file-status','result-status','context','print-report','quick-actions','external','to-tasks','retry','login-note','case-title'];
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
 const nodes=Object.fromEntries(['messages','question','attach-input','file-list','file-status','result-status','context','print-report','quick-actions','external','to-tasks','retry','login-note','case-title']
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
