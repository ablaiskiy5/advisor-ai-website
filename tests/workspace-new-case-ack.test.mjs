import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('async function persist(e){');
const end=html.indexOf('async function remove(id){',start);
assert.ok(start>0&&end>start,'Production Workspace case creation exists');
const source=html.slice(start,end);

function fixture(mode='confirmed',cloudMode=true){
 const caseRow={id:'case-new',kind:'ideas',title:'Synthetic idea',notes:'Synthetic notes'};
 const calls={writes:0,insert:null,selection:'',toasts:[],localSaves:0};
 const ctx={
  entries:[],authRevision:7,session:{user:{id:'owner-A'}},
  isCloud:()=>cloudMode,
  saveLocal(){calls.localSaves++},
  toast(message){calls.toasts.push(message)},
  isCurrentWorkspaceSession:(revision,ownerId)=>ctx.authRevision===revision&&ctx.session?.user?.id===ownerId,
  cloud:{from(table){
   assert.equal(table,'workspace_items');
   return {
    insert(row){calls.writes++;calls.insert=row;return this},
    select(columns){calls.selection=columns;return this},
    async single(){
     if(mode==='signout')ctx.session=null;
     if(mode==='switch-owner')ctx.session={user:{id:'owner-B'}};
     if(mode==='relogin')ctx.authRevision++;
     if(mode==='network-error')throw Error('Network unavailable');
     if(mode==='db-error')return {data:null,error:{code:'23505',message:'duplicate ID'}};
     if(mode==='missing')return {data:null,error:null};
     return {data:{id:mode==='wrong-id'?'case-other':caseRow.id,user_id:mode==='wrong-owner'?'owner-B':'owner-A'},error:null};
    }
   };
  }}
 };
 const persist=runInNewContext(source+'\n;persist',ctx);
 return {persist,ctx,calls,caseRow};
}

test('new cloud case uses INSERT, never UPSERT, and requires exact returned case and owner',async()=>{
 const f=fixture();
 assert.equal(await f.persist(f.caseRow),true);
 assert.equal(f.calls.writes,1);
 assert.equal(f.calls.insert.id,'case-new');
 assert.equal(f.calls.insert.user_id,'owner-A');
 assert.equal(f.calls.selection,'id,user_id');
 assert.equal(f.ctx.entries.length,1);
 assert.equal(f.ctx.entries[0].user_id,undefined,'Keep owner ID out of local case representation');
 assert.equal(f.calls.toasts.length,0);
 assert.equal(f.calls.localSaves,0);
});

for(const mode of ['missing','db-error','wrong-id','wrong-owner','network-error']){
 test('unconfirmed new cloud case fails closed: '+mode,async()=>{
  const f=fixture(mode);
  assert.equal(await f.persist(f.caseRow),false);
  assert.equal(f.calls.writes,1);
  assert.equal(f.ctx.entries.length,0,'Never add an unacknowledged case to local state');
  assert.match(f.calls.toasts.join(' '),/Обнови список/);
 });
}

for(const mode of ['signout','switch-owner','relogin']){
 test('in-flight create cannot populate a stale session: '+mode,async()=>{
  const f=fixture(mode);
  assert.equal(await f.persist(f.caseRow),false);
  assert.equal(f.ctx.entries.length,0);
  assert.equal(f.calls.toasts.length,0,'Never show an old-owner result in a new session');
 });
}

test('offline case creation retains its local-only behavior',async()=>{
 const f=fixture('confirmed',false);
 assert.equal(await f.persist(f.caseRow),true);
 assert.equal(f.ctx.entries.length,1);
 assert.equal(f.calls.localSaves,1);
 assert.equal(f.calls.writes,0);
});
