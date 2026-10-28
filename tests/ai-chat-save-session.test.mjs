import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const start=html.indexOf('async function saveResult()'),end=html.indexOf('function printResult()',start);
assert.ok(start>0&&end>start,'Production saveResult exists');
const source=html.match(/^function isCurrentChat\(.*$/m)?.[0]+'\n'+html.slice(start,end)+'\n({saveResult})';
function database(read,write){
 const queries=[];
 return {queries,from(table){
  assert.equal(table,'workspace_items');
  return {
   select(){const filters=[];return {eq(k,v){filters.push([k,v]);return this},single(){queries.push({op:'read',filters});return read()}}},
   update(values){const filters=[];return {eq(k,v){filters.push([k,v]);return this},select(columns){assert.equal(columns,'id,notes');return this},single(){queries.push({op:'write',filters,values});return write(values)}}}
  };
 }};
}
function app(db){
 const nodes={'save-result':{disabled:false},'result-status':{textContent:''}};
 const ctx={db,caseId:'case-1',user:{id:'owner-a'},sessionEpoch:1,caseData:{notes:'old'},
  lastAnswer:'Synthetic analysis',working:false,$:id=>nodes[id]};
 return {ctx,nodes,save:runInNewContext(source,ctx).saveResult};
}
function ownerScoped(queries){
 for(const q of queries)assert.equal(JSON.stringify(q.filters),JSON.stringify([['id','case-1'],['user_id','owner-a']]));
}
test('successful save scopes read and write to owner and preserves the answer',async()=>{
 const db=database(async()=>({data:{notes:'Previous'},error:null}),async values=>({data:{id:'case-1',notes:values.notes},error:null})),a=app(db);
 await a.save();
 assert.equal(db.queries.length,2);ownerScoped(db.queries);
 assert.match(db.queries[1].values.notes,/Previous/);
 assert.match(db.queries[1].values.notes,/Synthetic analysis/);
 assert.equal(a.ctx.caseData.notes,db.queries[1].values.notes);
 assert.match(a.nodes['result-status'].textContent,/сохранён/);
 assert.equal(a.nodes['save-result'].disabled,false);
});
test('account switch during read prevents old-owner write and feedback',async()=>{
 let release;
 const db=database(()=>new Promise(r=>release=r),async()=>({error:null})),a=app(db),pending=a.save();
 a.ctx.sessionEpoch++;a.ctx.user={id:'owner-b'};a.ctx.caseData={notes:'Owner B'};
 a.nodes['result-status'].textContent='Owner B';a.nodes['save-result'].disabled=false;
 release({data:{notes:'Old owner'},error:null});await pending;
 assert.equal(db.queries.length,1);ownerScoped(db.queries);
 assert.equal(a.ctx.caseData.notes,'Owner B');
 assert.equal(a.nodes['result-status'].textContent,'Owner B');
 assert.equal(a.nodes['save-result'].disabled,false);
});
test('same-account re-login during write ignores late success',async()=>{
 let release;
 const db=database(async()=>({data:{notes:'Previous'},error:null}),()=>new Promise(r=>release=r)),a=app(db),pending=a.save();
 for(let i=0;i<4&&!release;i++)await Promise.resolve();
 assert.equal(typeof release,'function');
 a.ctx.sessionEpoch++;a.ctx.caseData={notes:'New login'};
 a.nodes['result-status'].textContent='New login';a.nodes['save-result'].disabled=false;
 release({error:null});await pending;
 assert.equal(db.queries.length,2);ownerScoped(db.queries);
 assert.equal(a.ctx.caseData.notes,'New login');
 assert.equal(a.nodes['result-status'].textContent,'New login');
 assert.equal(a.nodes['save-result'].disabled,false);
});
test('late write failure never leaks previous owner error',async()=>{
 let release;
 const db=database(async()=>({data:{notes:'Previous'},error:null}),()=>new Promise(r=>release=r)),a=app(db),pending=a.save();
 for(let i=0;i<4&&!release;i++)await Promise.resolve();
 assert.equal(typeof release,'function');
 a.ctx.sessionEpoch++;a.ctx.user={id:'owner-b'};a.ctx.caseData={notes:'Owner B'};
 a.nodes['result-status'].textContent='Owner B';
 release({error:{message:'Old owner secret error'}});await pending;
 assert.equal(a.nodes['result-status'].textContent,'Owner B');
});
test('unauthenticated save does not query database',async()=>{
 const db=database(async()=>({data:{notes:''},error:null}),async()=>({error:null})),a=app(db);
 a.ctx.user=null;await a.save();assert.equal(db.queries.length,0);
});
