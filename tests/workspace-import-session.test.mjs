import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('async function importData(file)');
const end=html.indexOf("document.addEventListener('click'",start);
assert.ok(start>0&&end>start,'Production backup import exists');
const source=html.slice(start,end);

function harness(){
 const writes=[],notices=[],confirmations=[];
 let renders=0,sequence=0;
 const ctx={
  authRevision:0,session:{user:{id:'owner-a'}},
  section:{ideas:{},portfolio:{}},
  draft:kind=>({kind,title:''}),uid:()=>String(++sequence),now:()=>new Date(0).toISOString(),
  persist:async row=>{writes.push(row);return true},
  toast:message=>notices.push(message),
  confirm:message=>{confirmations.push(message);return true},
  render:()=>{renders++}
 };
 const importData=runInNewContext(source+'\nimportData',ctx);
 return {ctx,importData,writes,notices,confirmations,renders:()=>renders};
}
const backup=rows=>({text:async()=>JSON.stringify({entries:rows})});
const sample=[{kind:'ideas',title:'Synthetic idea',user_id:'untrusted-owner'}];

test('valid backup imports into the active account without trusting embedded owner',async()=>{
 const h=harness();
 await h.importData(backup(sample));
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].user_id,undefined);
 assert.equal(h.writes[0].title,'Synthetic idea');
 assert.equal(h.confirmations.length,1);
 assert.equal(h.renders(),1);
 assert.match(h.notices[0],/Импортировано записей: 1/);
});

test('late file read after account switch cannot confirm or import old backup',async()=>{
 const h=harness();
 let resolveText;
 const pending=h.importData({text:()=>new Promise(resolve=>{resolveText=resolve})});
 h.ctx.authRevision++;
 h.ctx.session={user:{id:'owner-b'}};
 resolveText(JSON.stringify({entries:sample}));
 await pending;
 assert.equal(h.confirmations.length,0);
 assert.equal(h.writes.length,0);
 assert.equal(h.renders(),0);
 assert.equal(h.notices.length,0);
});

test('sign-out and same-account re-login invalidate pending import',async()=>{
 const h=harness();
 let resolveText;
 const pending=h.importData({text:()=>new Promise(resolve=>{resolveText=resolve})});
 h.ctx.authRevision+=2;
 h.ctx.session={user:{id:'owner-a'}};
 resolveText(JSON.stringify({entries:sample}));
 await pending;
 assert.equal(h.writes.length,0);
 assert.equal(h.confirmations.length,0);
});

test('account switch inside confirmation prevents all writes',async()=>{
 const h=harness();
 h.ctx.confirm=()=>{h.ctx.authRevision++;h.ctx.session={user:{id:'owner-b'}};return true};
 await h.importData(backup(sample));
 assert.equal(h.writes.length,0);
 assert.equal(h.renders(),0);
});

test('account switch during first write stops remaining records and stale feedback',async()=>{
 const h=harness();
 let resolveWrite;
 h.ctx.persist=row=>{h.writes.push(row);return new Promise(resolve=>{resolveWrite=resolve})};
 const pending=h.importData(backup([...sample,{kind:'portfolio',title:'Second synthetic case'}]));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.writes.length,1);
 h.ctx.authRevision++;
 h.ctx.session={user:{id:'owner-b'}};
 resolveWrite(true);
 await pending;
 assert.equal(h.writes.length,1);
 assert.equal(h.renders(),0);
 assert.equal(h.notices.length,0);
});

test('invalid backup payload is rejected without an unhandled exception',async()=>{
 const h=harness();
 await h.importData({text:async()=> 'null'});
 assert.equal(h.writes.length,0);
 assert.match(h.notices[0],/Неподходящий формат/);
});
