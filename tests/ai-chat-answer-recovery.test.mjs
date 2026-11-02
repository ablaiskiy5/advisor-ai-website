import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('async function history()'),html.indexOf('const allowedFiles='));
const question={id:'question-A',role:'user',content:'Synthetic question'};
const answer={id:'answer-A',role:'assistant',content:'Synthetic saved report'};
function fixture(){
 const nodes={};
 for(const id of ['messages','retry','reload-answer','file-status'])nodes[id]={children:[],textContent:'',hidden:true,
  append(node){this.children.push(node)},classList:{add(){nodes[id].hidden=true},remove(){nodes[id].hidden=false},toggle(_,v){nodes[id].hidden=v}}};
 let messages=[question],failRead=false,throwRead=false,invocations=0,warning='';
 const ctx={db:{from(table){return {select(){return this},eq(){return this},in(){return this},order(){return this},limit:async()=>{
  if(throwRead)throw Error('Synthetic network interruption');
  if(table==='advisor_ai_messages')return failRead?{error:{message:'Synthetic read outage'}}:{data:messages};
  return {data:[]};
 }}},functions:{invoke:async()=>{invocations++;messages=[answer,question];failRead=true;return {data:{ok:true,tools:{web_search_called:1}}}}}},
  user:{id:'owner-A'},caseData:{id:'case-A'},caseId:'case-A',sessionEpoch:1,historyRequestSeq:0,
  pendingAnswerMessageId:null,latestUserMessageId:question.id,lastAnswer:'',working:false,attachmentHistoryVerified:true,
  exhaustedRetryMessages:new Set(),incompleteUploadFor:()=>null,clearIncompleteUpload(){},
  isCurrentChat(epoch,owner){return ctx.sessionEpoch===epoch&&ctx.user?.id===owner},
  waiting(v){ctx.working=v},error(value){warning=value},$:id=>nodes[id],bubble:()=>({append(){}})};
 runInNewContext(source,ctx);
 return {ctx,nodes,get warning(){return warning},get invocations(){return invocations},setReadFailure(v){failRead=v},setThrownRead(v){throwRead=v},setMessages(rows){messages=rows}};
}

test('completed conversation hides paid retry without mutating newest-first query rows',async()=>{
 const f=fixture(),rows=[answer,question];f.setMessages(rows);
 const result=await f.ctx.history();
 assert.equal(result.latestRole,'assistant');assert.equal(f.nodes.retry.hidden,true);
 assert.equal(rows[0].id,answer.id,'Rendering must not reverse the source used to decide whether retry is needed');
 assert.equal(f.ctx.lastAnswer,answer.content);
 f.setMessages([{...question,id:'new-question'},answer,question]);await f.ctx.history();
 assert.equal(f.nodes.retry.hidden,false,'An actually unanswered question still offers retry');
});

test('saved AI answer with failed follow-up read recovers with one generation only',async()=>{
 const f=fixture();await f.ctx.requestAI();
 assert.equal(f.invocations,1);assert.equal(f.nodes.retry.hidden,true);assert.equal(f.nodes['reload-answer'].hidden,false);
 assert.equal(f.ctx.pendingAnswerMessageId,question.id);assert.equal(f.ctx.working,false);
 assert.match(f.warning,/без новой генерации/);assert.doesNotMatch(f.nodes['file-status'].textContent,/Проверка инструментов/);
 await f.ctx.requestAI();assert.equal(f.invocations,1,'Even an AI retry routes to read-only recovery while its answer is saved');
 f.setReadFailure(false);await f.ctx.refreshChatHistory();
 assert.equal(f.ctx.lastAnswer,answer.content);assert.equal(f.ctx.pendingAnswerMessageId,null);
 assert.equal(f.nodes['reload-answer'].hidden,true);assert.equal(f.nodes.retry.hidden,true);assert.equal(f.invocations,1);
 assert.match(f.nodes['file-status'].textContent,/Новый AI-запрос не запускался/);
});

test('thrown read failure after server acknowledgement also suppresses paid retry',async()=>{
 const f=fixture();f.setThrownRead(true);await f.ctx.requestAI();
 assert.equal(f.invocations,1);assert.equal(f.nodes.retry.hidden,true);assert.equal(f.ctx.working,false);
 assert.match(f.warning,/сохранённый ответ/);
});

test('a newer question from another tab does not trap recovery of the already saved answer',async()=>{
 const f=fixture();await f.ctx.requestAI();f.setReadFailure(false);
 f.setMessages([{...question,id:'another-tab-question'},answer,question]);await f.ctx.refreshChatHistory();
 assert.equal(f.ctx.pendingAnswerMessageId,null);assert.equal(f.ctx.lastAnswer,answer.content);
 assert.equal(f.nodes.retry.hidden,false,'Only the genuinely unanswered latest question is eligible');
 assert.equal(f.invocations,1);
});

test('history refresh does not race active generation or restore a signed-out result',async()=>{
 const f=fixture();f.ctx.working=true;await f.ctx.refreshChatHistory();assert.equal(f.invocations,0);
 f.ctx.working=false;
 let finish;f.ctx.db.from=()=>({select(){return this},eq(){return this},order(){return this},limit:()=>new Promise(resolve=>{finish=resolve})});
 const pending=f.ctx.refreshChatHistory();f.ctx.sessionEpoch++;f.ctx.user=null;f.ctx.lastAnswer='';
 finish({data:[answer,question]});await pending;
 assert.equal(f.ctx.lastAnswer,'');assert.equal(f.nodes['file-status'].textContent,'');
});
