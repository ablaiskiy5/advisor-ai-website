import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const source=readFileSync(new URL('../assets/workspace-workbenches.js',import.meta.url),'utf8');
function harness({persistResult=true,messageAck=true,resultMissing=false,resultError=false,invokeDeferred=null,persistDeferred=null}={}){
 const nodes=Object.fromEntries(['wb-form','wb-subject','wb-context','wb-horizon','wb-level','wb-status','wb-error','wb-result','wb-copy','wb-download'].map(id=>[id,{value:'',textContent:'',addEventListener(){},setAttribute(){}}]));
 const calls={cases:0,messages:[],invokes:0,reads:0};let owner='owner-a',epoch=0,latest=null;
 const document={getElementById:id=>nodes[id]||null};
 const db={from(table){assert.equal(table,'advisor_ai_messages');let insert=null;const filters=[];return{insert(row){insert=row;return this},select(){return this},eq(k,v){filters.push([k,v]);return this},gte(k,v){filters.push([k,v]);return this},order(){return this},limit(){return this},single:async()=>{calls.messages.push(insert);latest={...insert,id:'msg-1',created_at:'2026-10-28T00:00:00.000Z'};return{data:messageAck?latest:{...latest,user_id:'other'},error:null}},then(resolve){resolve({data:latest?[{...latest,user_id:'owner-a'},{id:'answer-1',user_id:'owner-a',case_id:'case-1',role:'assistant',content:'Saved answer',created_at:'2026-10-28T00:00:01.000Z'}].reverse():[],error:null})},maybeSingle:async()=>{calls.reads++;if(resultError){resultError=false;return{error:{message:'unavailable'}}}if(resultMissing){resultMissing=false;return{data:null}}return{data:{id:'answer-1',user_id:'owner-a',case_id:'case-1',role:'assistant',content:'## Вывод\nSynthetic answer',created_at:'2026-10-28T00:00:01.000Z'}}}}},functions:{invoke:async()=>{calls.invokes++;if(invokeDeferred)await invokeDeferred;return{data:{ok:true},error:null}}}};
 const ctx={document,URL,Blob,setTimeout,renderAnswerSafe:(node,text)=>node.textContent=text};runInNewContext(source,ctx);const api=ctx.AdvisorWorkbench;
 api.configure({db:()=>db,owner:()=>owner,epoch:()=>epoch,makeCase:kind=>({id:'case-1',kind}),persist:async e=>{calls.cases++;calls.caseData=e;if(persistDeferred)await persistDeferred;return persistResult},onUpdate(){}});
 api.open('ideas','company');api.mount('ideas');nodes['wb-subject'].value='NVDA';nodes['wb-context'].value='Проверить оценку';
 const submit=()=>nodes['wb-form'].onsubmit({preventDefault(){}});
 const settle=async()=>{for(let i=0;i<12&&api.pending();i++)await new Promise(r=>setImmediate(r));api.mount('ideas')};
 return{api,nodes,calls,submit,settle,switchOwner(){owner='owner-b';epoch++;api.reset()}};
}
test('workflow has no paid or database side effects until explicit submit and produces an inline result',async()=>{
 const h=harness();assert.equal(h.calls.cases,0);assert.equal(h.calls.invokes,0);h.submit();await h.settle();
 assert.equal(h.calls.cases,1);assert.equal(h.calls.invokes,1);assert.equal(h.calls.messages.length,1);assert.match(h.calls.messages[0].content,/Тема: NVDA/);assert.match(h.calls.messages[0].content,/Горизонт|источники|датами/);assert.match(h.nodes['wb-result'].textContent,/Synthetic answer/);assert.match(h.api.markup('ideas'),/Обсудить в чате/);
});
test('case or message acknowledgement failure prevents a paid request',async()=>{
 for(const opts of [{persistResult:false},{messageAck:false}]){const h=harness(opts);h.submit();await h.settle();assert.equal(h.calls.invokes,0);assert.match(h.nodes['wb-error'].textContent,/подтвержден|подтверждена|подтверждено/i)}
});
test('a saved answer is reloaded without repeating a paid call after a read failure',async()=>{
 const h=harness({resultError:true});h.submit();await h.settle();assert.equal(h.calls.invokes,1);assert.match(h.api.markup('ideas'),/Обновить результат без AI-запроса/);
 h.nodes['wb-retry']={};h.api.mount('ideas');h.nodes['wb-retry'].onclick();await h.settle();assert.equal(h.calls.invokes,1);assert.equal(h.calls.messages.length,1);assert.match(h.nodes['wb-result'].textContent,/Synthetic answer/);
});
test('successful AI with delayed result never silently launches another paid request',async()=>{
 const h=harness({resultMissing:true});h.submit();await h.settle();assert.equal(h.calls.invokes,1);assert.match(h.nodes['wb-error'].textContent,/без нового AI-запроса/);
});
test('signout/account switch during case creation or AI completion discards old private state',async()=>{
 let release;const deferred=new Promise(r=>release=r);
 const a=harness({persistDeferred:deferred});a.submit();a.switchOwner();release();await new Promise(r=>setImmediate(r));assert.equal(a.calls.invokes,0);assert.equal(a.api.markup('ideas'),'');
 let finish;const later=new Promise(r=>finish=r);const b=harness({invokeDeferred:later});b.submit();for(let i=0;i<4;i++)await Promise.resolve();b.switchOwner();finish();await new Promise(r=>setImmediate(r));assert.equal(b.api.markup('ideas'),'');assert.equal(b.calls.reads,0);
});
test('double submit during case creation reserves only one request',async()=>{
 let release;const deferred=new Promise(r=>release=r),h=harness({persistDeferred:deferred});h.submit();h.submit();release();await h.settle();assert.equal(h.calls.cases,1);assert.equal(h.calls.invokes,1);
});
test('six distinct workflows have task-specific entry points and exam semantics',()=>{
 const h=harness();for(const [kind,flow]of[['ideas','company'],['ideas','sector'],['markets','review'],['markets','scenario'],['academy','learn'],['academy','exam']]){assert.equal(h.api.supports(kind,flow),true);h.api.open(kind,flow);assert.match(h.api.markup(kind),/РАБОЧАЯ ОБЛАСТЬ/)}assert.match(h.api.markup('academy'),/Один вопрос|один вопрос/);assert.equal(h.api.supports('portfolio','chat'),false);
});

test('saved workbench results reopen in the section without creating a case or paid call',async()=>{
 const h=harness();h.submit();await h.settle();const e=h.calls.caseData;h.api.reset();await h.api.resume(e);h.api.mount('ideas');assert.equal(h.calls.invokes,1);assert.equal(h.calls.cases,1);assert.match(h.nodes['wb-result'].textContent,/Saved answer/);assert.match(h.api.markup('ideas'),/Открыт сохранённый результат/);assert.match(h.api.markup('ideas'),/<details class="wb-new">/);
});
