import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
const source=readFileSync(new URL('../assets/task-review-store.js',import.meta.url),'utf8');
function fixture(){
 const storage=new Map(),owner='owner-A',messages=[];
 let row={id:randomUUID(),user_id:owner,source_text:'Synthetic raw task list',revision:randomUUID(),tasks:[{id:randomUUID(),title:'Original task'}],created_at:'2026-11-03T00:00:00Z'},fail=false,writes=0;
 const db={from(table){assert.equal(table,'advisor_task_drafts');let changes=null,deleting=false;const filters=[];return {
  select(){return this},eq(k,v){filters.push(r=>r?.[k]===v);return this},order(){return this},limit(){return this},update(data){changes=data;return this},delete(){deleting=true;return this},single(){return this},maybeSingle(){return this},
  then(resolve){if(fail){resolve({data:null,error:{message:'Synthetic offline'}});return}if(!row||!filters.every(f=>f(row))){resolve({data:null,error:changes?{message:'Revision conflict'}:null});return}if(changes){writes++;row={...row,...structuredClone(changes)}}const data=structuredClone(row);if(deleting)row=null;resolve({data,error:null})}
 }}};
 function create(ownerId=owner){const ctx={structuredClone,crypto:{randomUUID},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};runInNewContext(source,ctx);return ctx.AdvisorTaskReviews.create({db,ownerId,onStatus:v=>messages.push(v)})}
 return {create,storage,messages,get row(){return row},set row(value){row=value},set fail(value){fail=value},get writes(){return writes}};
}
test('cloud review survives a fresh tab and includes confirmed edits',async()=>{
 const f=fixture(),first=f.create();await first.load();first.cache([{...f.row.tasks[0],title:'Edited task',include:false}]);assert.equal(await first.save(),true);
 f.storage.clear();const next=f.create(),restored=await next.load();assert.equal(restored.tasks[0].title,'Edited task');assert.equal(restored.tasks[0].include,false);assert.equal(f.writes,1);
});
test('reload before cloud save restores the synchronous local backup',async()=>{
 const f=fixture(),first=f.create();await first.load();first.cache([{...f.row.tasks[0],title:'Latest unsent edit'}]);
 const next=f.create(),restored=await next.load();assert.equal(restored.tasks[0].title,'Latest unsent edit');assert.equal(restored.dirty,true);
 await next.save();assert.equal(f.row.tasks[0].title,'Latest unsent edit');
});
test('failed cloud saves retain edited cards for reload',async()=>{
 const f=fixture(),first=f.create();await first.load();first.cache([{...f.row.tasks[0],title:'Offline edit'}]);f.fail=true;assert.equal(await first.save(),false);
 const next=f.create(),restored=await next.load();assert.equal(restored.tasks[0].title,'Offline edit');assert.equal(first.unsafe,true);
});
test('account B cannot recover account A local review',async()=>{
 const f=fixture(),a=f.create();await a.load();a.cache(f.row.tasks);const b=f.create('owner-B');assert.equal(await b.load(),null);
 a.dispose();assert.equal(f.storage.size,0);assert.ok(f.row,'Sign-out never deletes the cloud review');
});
test('revision conflict does not overwrite another tab and keeps the local copy',async()=>{
 const f=fixture(),a=f.create();await a.load();a.cache([{...f.row.tasks[0],title:'Local version'}]);f.row={...f.row,revision:randomUUID(),tasks:[{title:'Another tab version'}]};
 assert.equal(await a.save(),false);assert.equal(f.row.tasks[0].title,'Another tab version');assert.equal(a.active.tasks[0].title,'Local version');
});
test('cleanup failure is not thrown after tasks were already confirmed saved',async()=>{
 const f=fixture(),a=f.create();await a.load();f.fail=true;assert.equal(await a.clear(),false);assert.ok(a.active);
 f.fail=false;assert.equal(await a.clear(),true);assert.equal(f.row,null);assert.equal(f.storage.size,0);
});
