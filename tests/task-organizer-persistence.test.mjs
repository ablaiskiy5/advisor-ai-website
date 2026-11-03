import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
const code=readFileSync(new URL('../supabase/functions/advisor-ai-organize-tasks/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'');
async function invoke({existing=null,failInsert=false}={}){
 let handler,row=existing,calls=0,quota=0,sourceBeforePaid=false;
 const owner=randomUUID();
 const db={auth:{getUser:async()=>({data:{user:{id:owner,email:'synthetic@example.invalid',email_confirmed_at:'2026-01-01'}}})},
  rpc:async name=>{if(name==='reserve_advisor_task_ai_request'){quota++;return {data:'ok'}}return {data:true}},
  from(){let update=null,insert=null;const filters=[];return {select(){return this},eq(k,v){filters.push(r=>r?.[k]===v);return this},update(v){update=v;return this},insert(v){insert=v;return this},single(){return this},maybeSingle(){return this},then(resolve){
   if(insert){if(failInsert){resolve({error:{message:'Synthetic insert failure'}});return}row={id:randomUUID(),...insert}}
   else if(update&&row&&filters.every(f=>f(row)))row={...row,...update};
   resolve({data:row,error:null});
  }}}};
 runInNewContext(code,{createClient:()=>db,Request,Response,Date,crypto:{randomUUID},console,
  Deno:{env:{get:()=> 'synthetic'},serve(fn){handler=fn}},fetch:async()=>{calls++;sourceBeforePaid=row?.source_text==='Synthetic raw tasks';return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({tasks:[{title:'Synthetic task',area:'work',priority:'high',due_date:'',description:''}]})}]}]}))}});
 const response=await handler(new Request('https://synthetic.invalid/tasks',{method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({text:'Synthetic raw tasks'})}));
 return {response,body:await response.json(),row,calls,quota,sourceBeforePaid};
}
test('organizer stores source before paid inference and generated cards before responding',async()=>{
 const r=await invoke();assert.equal(r.response.status,200);assert.equal(r.calls,1);assert.equal(r.sourceBeforePaid,true);
 assert.equal(r.body.draft_id,r.row.id);assert.equal(r.body.draft_revision,r.row.revision);assert.deepEqual(r.body.tasks,JSON.parse(JSON.stringify(r.row.tasks)));assert.match(r.body.tasks[0].id,/^[0-9a-f-]{36}$/);
});
test('failed source persistence never spends a paid model call',async()=>{
 const r=await invoke({failInsert:true});assert.equal(r.response.status,503);assert.equal(r.calls,0);
});
test('an existing review blocks another paid organization request',async()=>{
 const r=await invoke({existing:{id:randomUUID(),revision:randomUUID(),tasks:[{title:'Existing draft'}]}});
 assert.equal(r.response.status,409);assert.equal(r.calls,0);assert.equal(r.quota,0);
});
