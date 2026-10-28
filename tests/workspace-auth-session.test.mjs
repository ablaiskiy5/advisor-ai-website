import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('const isCloud='),end=html.indexOf('function draft(',start);
const operationsStart=html.indexOf('async function persist('),operationsEnd=html.indexOf('function newCaseForm(',operationsStart);
assert.ok(start>0&&end>start&&operationsStart>0&&operationsEnd>operationsStart,'Workspace auth and case functions exist');
const production=html.slice(start,end)+'\n'+html.slice(operationsStart,operationsEnd);

function harness(owner='owner-a'){
 const reads=[],writes=[],timers=[],feedback=[],snapshotsCache=new Map([['old-snapshot',{private:true}]]);
 let renderCount=0;
 const cloud={from(table){
  assert.equal(table,'workspace_items');
  const filters=[];
  return {
   select(){return this},eq(key,value){filters.push([key,value]);return this},
   order(){return this},limit(){return new Promise(resolve=>reads.push({table,filters,resolve}))},
   insert(row){writes.push({row,resolve:null});return this},
   single(){return new Promise(resolve=>{writes.at(-1).resolve=resolve})}
  };
 }};
 const ctx={
  cloud,session:{user:{id:owner}},authRevision:0,entries:[{id:'old-case',title:'PRIVATE OLD CASE'}],
  snapshotsCache,active:'old-case',newCaseKind:null,page:'portfolio',busy:true,
  render(){renderCount++},toast:message=>feedback.push(message),saveLocal(){},
  setTimeout:fn=>{timers.push(fn)},URLSearchParams,window:{location:{search:''}}
 };
 const app=runInNewContext(production+'\n({refresh,persist,handleWorkspaceAuthChange,isCurrentWorkspaceSession,state:()=>({entries,session,authRevision,active,busy})})',ctx);
 return {app,reads,writes,timers,feedback,snapshotsCache,renderCount:()=>renderCount};
}

test('sign-out clears cases and snapshot cache immediately; stale case response cannot restore them',async()=>{
 const h=harness(),old=h.app.refresh();
 assert.deepEqual(Array.from(h.reads[0].filters[0]),['user_id','owner-a']);
 h.app.handleWorkspaceAuthChange('SIGNED_OUT',null);
 assert.equal(h.app.state().entries.length,0);
 assert.equal(h.app.state().session,null);
 assert.equal(h.app.state().active,null);
 assert.equal(h.app.state().busy,false);
 assert.equal(h.snapshotsCache.size,0);
 h.reads[0].resolve({data:[{id:'old-case',title:'PRIVATE OLD CASE'}],error:null});
 await old;
 assert.equal(h.app.state().entries.length,0);
 assert.equal(h.feedback.length,0);
});

test('account switch isolates old response and scopes new list to its owner',async()=>{
 const h=harness(),old=h.app.refresh();
 h.app.handleWorkspaceAuthChange('SIGNED_IN',{user:{id:'owner-b'}});
 assert.equal(h.app.state().entries.length,0);
 assert.equal(h.timers.length,1);
 h.reads[0].resolve({data:[{id:'old-case',title:'PRIVATE OLD CASE'}],error:null});
 await old;
 assert.equal(h.app.state().entries.length,0);
 h.timers[0]();
 assert.deepEqual(Array.from(h.reads[1].filters[0]),['user_id','owner-b']);
 h.reads[1].resolve({data:[{id:'new-case',title:'Synthetic B'}],error:null});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.app.state().entries[0].title,'Synthetic B');
});

test('same-account re-login rejects a prior session response',async()=>{
 const h=harness(),old=h.app.refresh();
 h.app.handleWorkspaceAuthChange('SIGNED_OUT',null);
 h.app.handleWorkspaceAuthChange('SIGNED_IN',{user:{id:'owner-a'}});
 h.reads[0].resolve({data:[{id:'old-case',title:'PRIVATE OLD CASE'}],error:null});
 await old;
 assert.equal(h.app.state().entries.length,0);
});

test('late case save cannot repopulate another account or show previous error',async()=>{
 const h=harness(),old=h.app.persist({id:'old-case',title:'PRIVATE OLD CASE'});
 assert.equal(h.writes[0].row.user_id,'owner-a');
 h.app.handleWorkspaceAuthChange('SIGNED_IN',{user:{id:'owner-b'}});
 h.writes[0].resolve({error:{message:'old request failed'}});
 assert.equal(await old,false);
 assert.equal(h.app.state().entries.length,0);
 assert.equal(h.feedback.length,0);
});

test('snapshot history and writes are owner-scoped and session-guarded',()=>{
 const save=html.slice(html.indexOf('async function saveSnapshot()'),html.indexOf('async function loadSnapshots()'));
 const load=html.slice(html.indexOf('async function loadSnapshots()'),html.indexOf('function compareSnapshots()'));
 assert.match(save,/user_id:ownerId/);
 assert.match(save,/isCurrentWorkspaceSession\(revision,ownerId\)/);
 assert.match(load,/\.eq\('user_id',ownerId\)/);
 assert.match(load,/isCurrentWorkspaceSession\(revision,ownerId\)/);
 assert.match(html,/onAuthStateChange\(\(event,nextSession\)=>handleWorkspaceAuthChange\(event,nextSession\)\)/);
});
