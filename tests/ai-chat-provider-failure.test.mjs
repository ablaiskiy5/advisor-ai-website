import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('async function requestAI()'),html.indexOf('const allowedFiles='));
function fixture(message){
 const nodes=Object.fromEntries(['retry','file-status'].map(id=>[id,{textContent:'',classList:{hidden:true,add(){this.hidden=true},remove(){this.hidden=false}}}]));
 let error='';const waits=[];
 const ctx={working:false,caseData:{id:'case'},caseId:'case',user:{id:'owner'},sessionEpoch:1,attachmentHistoryVerified:true,latestUserMessageId:'message',exhaustedRetryMessages:new Set(),incompleteUploadFor:()=>null,isCurrentChat:()=>true,$:id=>nodes[id],waiting:v=>waits.push(v),error:v=>error=v,
 db:{functions:{invoke:async()=>({error:{message:'Server failed',context:{json:async()=>({error:message})}}})}}};
 return {run:runInNewContext(code+';requestAI',ctx),nodes,waits,get error(){return error}};
}
test('billing failure stops busy status, hides retry and explains saved data and owner action',async()=>{
 const f=fixture('Исчерпан API-баланс сервиса. Владельцу нужно пополнить баланс.');await f.run();
 assert.match(f.error,/пополнить баланс/);assert.doesNotMatch(f.error,/трёх попыток|частоту/);assert.match(f.nodes['file-status'].textContent,/не завершён/);assert.equal(f.nodes.retry.classList.hidden,true);assert.deepEqual(f.waits,[true,false]);
});
test('transient rate failure reveals the real retry action and clears busy status',async()=>{
 const f=fixture('AI временно ограничил частоту запросов. Попробуй позже.');await f.run();
 assert.equal(f.nodes.retry.classList.hidden,false);assert.match(f.error,/Повторить ответ AI/);assert.match(f.nodes['file-status'].textContent,/не завершён/);
});
