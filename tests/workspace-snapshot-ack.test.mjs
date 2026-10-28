import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
function source(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Missing production function '+start);
 return html.slice(a,b);
}
const saveCode=source('async function saveSnapshot(){','async function loadSnapshots(){');
const loadCode=source('async function loadSnapshots(){','function compareSnapshots(){');
const uuid='11111111-1111-4111-8111-111111111111';

function saveFixture(mode='ok'){
 const row={id:'case-1',kind:'portfolio',title:'Synthetic'};
 const calls={messages:[],loads:0,payload:null,selection:''};
 const ctx={
  entries:[row],active:row.id,authRevision:3,session:{user:{id:'owner-A'}},
  isCloud:()=>true,parseHoldings:()=>({rows:[{},{}]}),
  document:{getElementById:id=>({'holdings-input':{value:'AAPL; 2; 100'},'target-bonds':{value:'25'}}[id]??null)},
  window:{prompt:()=> 'Synthetic note'},
  snapshotUi:message=>calls.messages.push(message),
  loadSnapshots:async()=>{calls.loads++},
  isCurrentWorkspaceSession:(rev,owner)=>ctx.authRevision===rev&&ctx.session?.user?.id===owner,
  cloud:{from(table){
   assert.equal(table,'portfolio_snapshots');
   return {
    insert(payload){calls.payload=payload;return this},
    select(columns){calls.selection=columns;return this},
    async single(){
     if(mode==='signout')ctx.session=null;
     if(mode==='switch-owner')ctx.session={user:{id:'owner-B'}};
     if(mode==='relogin')ctx.authRevision++;
     if(mode==='switch-case')ctx.active='case-2';
     if(mode==='throw')throw Error('Network unavailable');
     if(mode==='undefined')return undefined;
     if(mode==='error')return {data:null,error:{message:'RLS denied'}};
     if(mode==='missing')return {data:null,error:null};
     const data={id:uuid,case_id:row.id,user_id:'owner-A',title:row.title,
      holdings:'AAPL; 2; 100',target_bond_pct:'25',notes:'Synthetic note'};
     if(mode==='wrong-owner')data.user_id='owner-B';
     if(mode==='wrong-case')data.case_id='case-2';
     if(mode==='wrong-data')data.holdings='MSFT; 2; 100';
     if(mode==='wrong-target')data.target_bond_pct='26';
     if(mode==='bad-id')data.id='invalid';
     return {data,error:null};
    }
   };
  }}
 };
 return {save:runInNewContext(saveCode+'\n;saveSnapshot',ctx),ctx,calls};
}

test('snapshot insert requires owner/case and exact returned acknowledgement',async()=>{
 const f=saveFixture();await f.save();
 assert.equal(f.calls.payload.case_id,'case-1');
 assert.equal(f.calls.payload.user_id,'owner-A');
 assert.equal(f.calls.payload.target_bond_pct,25);
 assert.equal(f.calls.selection,'id,case_id,user_id,title,holdings,target_bond_pct,notes');
 assert.equal(f.calls.loads,1);
 assert.match(f.calls.messages.join(' '),/Снимок сохранён/);
});

for(const mode of ['missing','undefined','error','throw','wrong-owner','wrong-case','wrong-data','wrong-target','bad-id']){
 test('snapshot fails closed on unconfirmed write: '+mode,async()=>{
  const f=saveFixture(mode);await f.save();
  assert.equal(f.calls.loads,0);
  assert.doesNotMatch(f.calls.messages.join(' '),/Снимок сохранён/);
  assert.match(f.calls.messages.join(' '),/Не удалось|не подтверждено/);
 });
}

for(const mode of ['signout','switch-owner','relogin','switch-case']){
 test('snapshot ignores stale response: '+mode,async()=>{
  const f=saveFixture(mode);await f.save();
  assert.equal(f.calls.loads,0);
  assert.equal(f.calls.messages.length,0);
 });
}

function historyFixture(){
 const pending=[],messages=[],holder={textContent:'',children:[],append(el){this.children.push(el)}};
 const ctx={
  entries:[{id:'case-1',kind:'portfolio'}],active:'case-1',authRevision:3,
  session:{user:{id:'owner-A'}},snapshotLoadRevision:0,snapshotsCache:new Map(),
  isCloud:()=>true,
  isCurrentWorkspaceSession:(rev,owner)=>ctx.authRevision===rev&&ctx.session?.user?.id===owner,
  snapshotUi:message=>messages.push(message),
  document:{getElementById:id=>id==='snapshot-history'?holder:null,
   createElement:tag=>({tag,textContent:'',append(){}})},
  cloud:{from(table){
   assert.equal(table,'portfolio_snapshots');
   return {select(){return this},eq(){return this},order(){return this},
    limit(){return new Promise(resolve=>pending.push(resolve))}};
  }}
 };
 return {load:runInNewContext(loadCode+'\n;loadSnapshots',ctx),ctx,pending,messages,holder};
}

test('older history response cannot overwrite a newer same-case load',async()=>{
 const f=historyFixture(),first=f.load(),second=f.load();
 assert.equal(f.pending.length,2);
 f.pending[1]({data:[],error:null});await second;
 f.pending[0]({data:null,error:{message:'Old error'}});await first;
 assert.equal(f.holder.children.length,1);
 assert.equal(f.messages.length,0);
 assert.equal(f.ctx.snapshotLoadRevision,2);
});

for(const mode of ['switch-case','signout']){
 test('history ignores stale '+mode,async()=>{
  const f=historyFixture(),request=f.load();
  if(mode==='switch-case')f.ctx.active='case-2';
  else {f.ctx.session=null;f.ctx.authRevision++}
  f.pending[0]({data:[],error:null});await request;
  assert.equal(f.holder.children.length,0);
  assert.equal(f.messages.length,0);
 });
}
