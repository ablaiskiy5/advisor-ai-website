import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const start=html.indexOf('async function saveResult()');
const end=html.indexOf('function printResult()',start);
assert.ok(start>0&&end>start,'Production saveResult function exists');
const source=html.slice(start,end);

function fixture(mode='confirmed'){
 const nodes={'save-result':{disabled:false},'result-status':{textContent:''}};
 const calls={reads:0,writes:0,filters:[],nullFilters:[],selections:[],payload:null};
 const ctx={
  working:false,lastAnswer:'Synthetic advisor summary',
  caseData:{id:'case-A',notes:'Previous synthetic notes'},
  user:{id:'owner-A'},sessionEpoch:1,caseId:'case-A',
  $:id=>nodes[id],
  isCurrentChat:(epoch,ownerId)=>epoch===ctx.sessionEpoch&&ctx.user?.id===ownerId,
  db:{from(table){
   assert.equal(table,'workspace_items');
   let isUpdate=false;
   return {
    select(columns){calls.selections.push(columns);return this},
    eq(column,value){calls.filters.push([column,value]);return this},
    is(column,value){calls.nullFilters.push([column,value]);return this},
    update(payload){isUpdate=true;calls.writes++;calls.payload=payload;return this},
    async single(){
     if(!isUpdate){calls.reads++;return {data:{notes:mode==='already-saved'?'Synthetic advisor summary':'Previous synthetic notes',updated_at:mode==='null-version'?null:mode==='bad-version'?'not-a-date':'2026-10-28T00:00:00.000Z'},error:null}}
     if(mode==='no-row')return {data:null,error:null};
     if(mode==='concurrent-edit')return {data:null,error:{code:'PGRST116',message:'No rows matched the version guard'}};
     if(mode==='postgrest-error')return {data:null,error:{message:'No matching row'}};
     return {data:{id:mode==='wrong-id'?'case-B':'case-A',
       notes:mode==='wrong-notes'?'Unexpected notes':calls.payload.notes},error:null};
    }
   };
  }}
 };
 const save=runInNewContext(source+'\n;saveResult',ctx);
 return {ctx,nodes,calls,save};
}

test('case summary is confirmed by a returned owner-scoped row before claiming success',async()=>{
 const f=fixture();
 await f.save();
 assert.equal(f.calls.reads,1);
 assert.equal(f.calls.writes,1);
 assert.deepEqual(f.calls.filters,[['id','case-A'],['user_id','owner-A'],['id','case-A'],['user_id','owner-A'],['updated_at','2026-10-28T00:00:00.000Z']]);
 assert.deepEqual(f.calls.selections,['notes,updated_at','id,notes']);
 assert.ok(Date.parse(f.calls.payload.updated_at)>Date.parse('2026-10-28T00:00:00.000Z'),'Write advances version');
 assert.deepEqual(f.calls.nullFilters,[]);
 assert.match(f.ctx.caseData.notes,/Synthetic advisor summary/);
 assert.match(f.nodes['result-status'].textContent,/Итог сохранён/);
 assert.equal(f.nodes['save-result'].disabled,false);
});

for(const mode of ['no-row','postgrest-error','wrong-id','wrong-notes']){
 test('case summary does not report success without server confirmation: '+mode,async()=>{
  const f=fixture(mode);
  await f.save();
  assert.equal(f.ctx.caseData.notes,'Previous synthetic notes','Do not update local case on an unconfirmed write');
  assert.match(f.nodes['result-status'].textContent,/Не удалось сохранить итог/);
  assert.doesNotMatch(f.nodes['result-status'].textContent,/Итог сохранён/);
  assert.equal(f.nodes['save-result'].disabled,false);
 });
}

for(const mode of ['concurrent-edit','bad-version']){
 test('case summary fails closed on concurrent edit or invalid version: '+mode,async()=>{
  const f=fixture(mode);
  await f.save();
  assert.equal(f.ctx.caseData.notes,'Previous synthetic notes');
  assert.match(f.nodes['result-status'].textContent,/Не удалось сохранить итог/);
  assert.doesNotMatch(f.nodes['result-status'].textContent,/Итог сохранён/);
  assert.equal(f.calls.writes,mode==='bad-version'?0:1);
  if(mode==='concurrent-edit')assert.match(f.nodes['result-status'].textContent,/Карточка изменилась/);
 });
}

test('legacy NULL updated_at is guarded by IS NULL, not an unguarded write',async()=>{
 const f=fixture('null-version');
 await f.save();
 assert.deepEqual(f.calls.nullFilters,[['updated_at',null]]);
 assert.equal(f.calls.writes,1);
 assert.match(f.nodes['result-status'].textContent,/Итог сохранён/);
});

test('already-saved summary does not write or append twice',async()=>{
 const f=fixture('already-saved');
 await f.save();
 assert.equal(f.calls.writes,0);
 assert.match(f.nodes['result-status'].textContent,/уже сохранён/);
});
