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
 const calls={reads:0,writes:0,filters:[],selections:[],payload:null};
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
    update(payload){isUpdate=true;calls.writes++;calls.payload=payload;return this},
    async single(){
     if(!isUpdate){calls.reads++;return {data:{notes:'Previous synthetic notes'},error:null}}
     if(mode==='no-row')return {data:null,error:null};
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
 assert.deepEqual(f.calls.filters,[['id','case-A'],['user_id','owner-A'],['id','case-A'],['user_id','owner-A']]);
 assert.deepEqual(f.calls.selections,['notes','id,notes']);
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
