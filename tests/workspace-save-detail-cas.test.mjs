import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('async function saveDetail(id){');
const end=html.indexOf('async function deleteItem(id)',start);
assert.ok(start>0&&end>start,'Production workspace saveDetail exists');
const source=html.slice(start,end);

function fixture(mode='confirmed'){
 const version='2026-10-28T01:00:00.000Z';
 const row={id:'case-A',kind:'portfolio',title:'Original',status:'Новая',notes:'Previous notes',prompt:'Old prompt',chat_url:'',updated_at:mode==='bad-version'?'invalid':version};
 const fields={'f-title':'Revised','f-chat':'','f-kind':'portfolio','f-status':'В работе','f-notes':'Revised notes','f-prompt':'Revised prompt'};
 const calls={filters:[],payload:null,selection:'',renders:0,toasts:[],writes:0};
 const ctx={
  entries:[{...row}],session:{user:{id:'owner-A'}},authRevision:4,
  isCloud:()=>true,now:()=>version,validChat:()=>true,
  isCurrentWorkspaceSession:(revision,ownerId)=>ctx.authRevision===revision&&ctx.session?.user?.id===ownerId,
  document:{getElementById:id=>({value:fields[id]})},
  render(){calls.renders++},toast(message){calls.toasts.push(message)},
  cloud:{from(table){
   assert.equal(table,'workspace_items');
   return {
    update(payload){calls.payload=payload;calls.writes++;return this},
    eq(column,value){calls.filters.push([column,value]);return this},
    select(columns){calls.selection=columns;return this},
    async single(){
     if(mode==='stale-session')ctx.session={user:{id:'owner-B'}};
     if(mode==='conflict')return {data:null,error:{code:'PGRST116',message:'No rows'}};
     if(mode==='missing')return {data:null,error:null};
     if(mode==='db-error')return {data:null,error:{message:'Database unavailable'}};
     return {data:{id:mode==='wrong-id'?'case-B':'case-A',...calls.payload,title:mode==='wrong-ack'?'Other title':calls.payload.title},error:null};
    }
   };
  }}
 };
 const save=runInNewContext(source+'\n;saveDetail',ctx);
 return {ctx,calls,save,version};
}

test('workspace detail edit requires owner and exact prior version, then acknowledges server row',async()=>{
 const f=fixture();
 await f.save('case-A');
 assert.equal(f.calls.writes,1);
 assert.deepEqual(f.calls.filters,[['id','case-A'],['user_id','owner-A'],['updated_at',f.version]]);
 assert.match(f.calls.selection,/updated_at/);
 assert.ok(Date.parse(f.calls.payload.updated_at)>Date.parse(f.version),'Version must advance monotonically');
 assert.equal(f.ctx.entries[0].notes,'Revised notes');
 assert.equal(f.calls.renders,1);
 assert.match(f.calls.toasts.at(-1),/Изменения сохранены/);
});

for(const mode of ['conflict','missing','db-error','wrong-id','wrong-ack','bad-version']){
 test('workspace detail edit fails closed: '+mode,async()=>{
  const f=fixture(mode);
  await f.save('case-A');
  assert.equal(f.ctx.entries[0].notes,'Previous notes','Do not change local data without confirmation');
  assert.equal(f.calls.renders,0);
  assert.doesNotMatch(f.calls.toasts.join(' '),/Изменения сохранены/);
  assert.ok(f.calls.toasts.length>0,'Explain why the save was not confirmed');
  if(mode==='bad-version')assert.equal(f.calls.writes,0);
  if(mode==='conflict'||mode==='missing')assert.match(f.calls.toasts.join(' '),/другой вкладке/);
 });
}

test('in-flight case save cannot restore old owner data after sign-out',async()=>{
 const f=fixture('stale-session');
 await f.save('case-A');
 assert.equal(f.ctx.entries[0].notes,'Previous notes');
 assert.equal(f.calls.renders,0);
 assert.equal(f.calls.toasts.length,0,'Do not display old-owner status in a new session');
});
