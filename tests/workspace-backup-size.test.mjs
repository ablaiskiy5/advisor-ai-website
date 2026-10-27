import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('async function importData(file){');
const end=html.indexOf("document.addEventListener('click'",start);
assert.ok(start>=0&&end>start,'Production JSON importer exists');
const source=html.slice(start,end);

function harness(){
 const messages=[],saved=[];let reads=0,confirms=0,renders=0;
 const env={
  authRevision:1,session:{user:{id:'synthetic-owner'}},
  section:{ideas:{prompt:'Synthetic prompt'}},
  draft:kind=>({id:'synthetic-id',kind}),
  persist:async item=>{saved.push(item);return true},
  render:()=>{renders++},
  toast:message=>messages.push(message),
  confirm:()=>{confirms++;return true}
 };
 const importData=new Function('env',
  'const {authRevision,session,section,draft,persist,render,toast,confirm}=env;\n'+
  source+'\nreturn importData;'
 )(env);
 const file=(size,body)=>({size,async text(){reads++;return body}});
 return {importData,file,messages,saved,get reads(){return reads},get confirms(){return confirms},get renders(){return renders}};
}

test('oversized JSON backup is rejected before allocating text or writing data',async()=>{
 const h=harness();
 await h.importData(h.file(64*1024*1024+1,'{}'));
 assert.equal(h.reads,0);
 assert.equal(h.confirms,0);
 assert.equal(h.saved.length,0);
 assert.equal(h.renders,0);
 assert.match(h.messages.at(-1),/больше 64 МБ/);
});

test('ordinary JSON backup still imports a synthetic case',async()=>{
 const h=harness();
 const body=JSON.stringify({entries:[{kind:'ideas',title:'Synthetic idea'}]});
 await h.importData(h.file(body.length,body));
 assert.equal(h.reads,1);
 assert.equal(h.confirms,1);
 assert.equal(h.saved.length,1);
 assert.equal(h.saved[0].title,'Synthetic idea');
 assert.equal(h.renders,1);
 assert.match(h.messages.at(-1),/Импортировано записей: 1/);
});
