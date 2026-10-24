import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../tasks-board.html'),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(inline,'Task-board inline script exists');
const offline=inline.replace(/^init\(\)\.catch\(e=>feedback\('Ошибка: '\+e\.message\)\);\s*$/m,'');
assert.notEqual(offline,inline,'Do not connect to production Supabase in unit tests');

function harness(){
 const elements=new Map(),messages=[],suggestions=[];
 let settle;
 const database={functions:{invoke(name,{body}) {
  assert.equal(name,'advisor-ai-organize-tasks');
  assert.equal(body.text,'Synthetic task only');
  return new Promise(resolve=>{settle=resolve});
 }}};
 const document={getElementById(id){
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,classList:{add(){},remove(){}}});
  return elements.get(id);
 }};
 const app=runInNewContext(offline+`
  render=()=>{};
  review=tasks=>globalThis.__suggestions.push(tasks);
  feedback=message=>globalThis.__messages.push(message);
  ({organize,handleTaskAuthChange,
    setUser:id=>{user=id?{id}:null},
    getEpoch:()=>authRevision})
 `,{Date,Intl,document,setTimeout:()=>{},__suggestions:suggestions,__messages:messages});
 app.setUser('account-a');
 document.getElementById('brain').value='Synthetic task only';
 return {...app,messages,suggestions,resolve:reply=>{
  assert.equal(typeof settle,'function','AI request was started');
  settle(reply);
 }};
}

test('normal AI response still opens review for the signed-in owner',async()=>{
 const app=harness();
 const pending=app.organize();
 app.resolve({data:{tasks:[{title:'Synthetic task'}]},error:null});
 await pending;
 assert.equal(app.suggestions.length,1);
 assert.match(app.messages.at(-1),/Предложения готовы/);
});

test('sign-out discards in-flight private AI proposals and old status',async()=>{
 const app=harness(),pending=app.organize();
 app.handleTaskAuthChange('SIGNED_OUT',null);
 app.resolve({data:{tasks:[{title:'Private old account task'}]},error:null});
 await pending;
 assert.equal(app.suggestions.length,0);
 assert.ok(!app.messages.some(x=>x.includes('Предложения готовы')));
 assert.equal(app.messages.at(-1),'Сессия завершена. Войди в Workspace заново.');
});

test('account switch discards old AI result, including re-login to same account',async()=>{
 for(const nextId of ['account-b','account-a']){
  const app=harness(),pending=app.organize(),oldEpoch=app.getEpoch();
  app.handleTaskAuthChange('SIGNED_OUT',null);
  app.setUser(nextId);
  assert.ok(app.getEpoch()>oldEpoch);
  app.resolve({data:{tasks:[{title:'Old private task'}]},error:null});
  await pending;
  assert.equal(app.suggestions.length,0,'Old session proposals must not reappear');
  assert.ok(!app.messages.some(x=>x.includes('Предложения готовы')));
 }
});

test('old AI errors do not overwrite new session status',async()=>{
 const app=harness(),pending=app.organize();
 app.handleTaskAuthChange('SIGNED_OUT',null);
 app.resolve({error:{message:'Old account API error'}});
 await pending;
 assert.ok(!app.messages.some(x=>x.includes('Old account API error')));
});
