import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const chat=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const board=readFileSync(new URL('../tasks-board.html',import.meta.url),'utf8');
const from=chat.indexOf('async function transferToTasks(){'),to=chat.indexOf('async function makeSummary(){',from);
const begin=board.indexOf('function consumeTaskTransfer('),end=board.indexOf('async function init(){',begin);
assert.ok(from>=0&&to>from&&begin>=0&&end>begin,'Production transfer helpers exist');
const transferSource=chat.slice(from,to),consumeSource=board.slice(begin,end);
function storage(raw){
 const data=new Map(raw===undefined?[]:[['advisor_ai_task_brain_dump',raw]]);
 return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
}
function chatHarness(){
 const staged=storage(),location={href:''};let settle;
 const db={from(name){assert.equal(name,'advisor_ai_messages');return {select(){return this},eq(){return this},order(){return this},limit(){return new Promise(r=>settle=r)}}}};
 const ctx={db,user:{id:'owner-a'},caseData:{kind:'tasks'},caseId:'synthetic-case',sessionEpoch:1,sessionStorage:staged,window:{location},error:()=>{}};
 ctx.isCurrentChat=(epoch,owner)=>epoch===ctx.sessionEpoch&&ctx.user?.id===owner&&!!ctx.caseData;
 const transfer=runInNewContext(transferSource+';transferToTasks',ctx);
 return {transfer,ctx,staged,location,reply:data=>{assert.ok(settle);settle({data,error:null})}};
}
function receiver(raw){
 const staged=storage(raw),brain={value:''},notices=[];
 const consume=runInNewContext(consumeSource+';consumeTaskTransfer',{sessionStorage:staged,$:()=>brain,feedback:message=>notices.push(message)});
 return {consume,staged,brain,notices};
}
test('owner can transfer synthetic tasks after authenticated handoff',async()=>{
 const a=chatHarness(),pending=a.transfer();a.reply([{role:'user',content:'Synthetic task'}]);await pending;
 const raw=a.staged.getItem('advisor_ai_task_brain_dump');
 assert.equal(JSON.parse(raw).owner_id,'owner-a');assert.equal(a.location.href,'./tasks-board.html');
 const b=receiver(raw);assert.equal(b.consume('owner-a'),true);assert.equal(b.brain.value,'Synthetic task');
 assert.equal(b.staged.getItem('advisor_ai_task_brain_dump'),null);
});
test('different owner and legacy unscoped transfer never render',()=>{
 for(const raw of [JSON.stringify({owner_id:'owner-a',text:'Private task'}),'Old unscoped task']){
  const b=receiver(raw);assert.equal(b.consume('owner-b'),false);assert.equal(b.brain.value,'');
  assert.equal(b.staged.getItem('advisor_ai_task_brain_dump'),null);
 }
});
test('stale response after sign-out, account switch or same-owner re-login is ignored',async()=>{
 for(const mode of ['out','switch','relogin']){
  const a=chatHarness(),pending=a.transfer();a.ctx.sessionEpoch++;
  a.ctx.user=mode==='switch'?{id:'owner-b'}:mode==='relogin'?{id:'owner-a'}:null;
  if(mode==='out')a.ctx.caseData=null;
  a.reply([{role:'user',content:'Private old task'}]);await pending;
  assert.equal(a.staged.getItem('advisor_ai_task_brain_dump'),null,mode);
  assert.equal(a.location.href,'',mode);
 }
});
test('consumer runs only after auth.getUser and sign-out clears transfer',()=>{
 assert.match(board,/const \{data,error\}=await db\.auth\.getUser\(\);[\s\S]*?user=data\.user;consumeTaskTransfer\(user\.id\);/);
 assert.match(board,/function clearTaskSession\([^)]*\)\{\s*try\{sessionStorage\.removeItem\('advisor_ai_task_brain_dump'\)/);
});

test('oversized chat handoff is never silently truncated',()=>{
 const fullText='Synthetic task; '.repeat(750);
 assert.ok(fullText.length>10000);
 const b=receiver(JSON.stringify({owner_id:'owner-a',text:fullText}));
 assert.equal(b.consume('owner-a'),true);
 assert.equal(b.brain.value,fullText,'The full draft must remain available to split or copy');
 assert.match(b.notices.at(-1),/10 000 символов/);
 assert.equal(b.staged.getItem('advisor_ai_task_brain_dump'),null,'One-time handoff remains owner-scoped');
});

test('oversized handoff cannot consume a paid AI parse request',async()=>{
 const start=board.indexOf('async function organize(){'),end=board.indexOf('async function saveDrafts(){',start);
 assert.ok(start>=0&&end>start,'Production organizer must exist');
 const notices=[],elements={brain:{value:'Synthetic task; '.repeat(750)},organize:{disabled:false}};
 let invoked=0;
 const db={functions:{invoke(){invoked++;throw Error('Must not invoke paid AI for invalid input')}}};
 const organize=runInNewContext(board.slice(start,end)+';organize',{
  busy:false,user:{id:'owner-a'},authRevision:0,db,
  $:id=>{assert.ok(elements[id]);return elements[id]},
  feedback:message=>notices.push(message)
 });
 await organize();
 assert.equal(invoked,0);
 assert.equal(elements.organize.disabled,false);
 assert.match(notices.at(-1),/не более 10 000 символов/);
});

test('chat-to-task handoff retains all tasks beyond the AI 10k input limit',async()=>{
 const a=chatHarness();
 const fullText='Synthetic task; '.repeat(750).trim();
 assert.ok(fullText.length>10000);
 const pending=a.transfer();
 a.reply([{role:'user',content:fullText}]);
 await pending;
 const raw=a.staged.getItem('advisor_ai_task_brain_dump');
 assert.ok(raw,'Transfer payload must exist');
 assert.equal(JSON.parse(raw).text,fullText,'No tasks may be silently discarded during handoff');
 const b=receiver(raw);
 assert.equal(b.consume('owner-a'),true);
 assert.equal(b.brain.value,fullText,'All tasks remain available for review and splitting');
 assert.match(b.notices.at(-1),/10 000 символов/);
});
