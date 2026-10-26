import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Test the production task-update functions without credentials or network access.
const html=readFileSync(new URL('../tasks-board.html',import.meta.url),'utf8');
function extract(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Missing task function: '+start);
 return html.slice(a,b);
}
const production=extract('async function change(item,fields){','function openTaskEditor(item){')+
 extract('async function submitTaskEditor(event){','async function editTask(item){');

function harness(response){
 const calls=[],messages=[],elements=new Map();let renders=0,loads=0;
 const $=id=>{
  if(!elements.has(id)){
   const classes=new Set();
   elements.set(id,{value:'',textContent:'',classList:{
    add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)
   }});
  }
  return elements.get(id);
 };
 const db={from(table){
  assert.equal(table,'advisor_tasks');
  return {update(fields){
   calls.push(['update',fields]);
   const chain={
    eq(key,value){calls.push(['eq',key,value]);return chain},
    select(cols){calls.push(['select',cols]);return chain},
    single(){calls.push(['single']);return Promise.resolve(response)}
   };
   return chain;
  },insert(values){
   calls.push(['insert',values]);
   return {select(cols){
    calls.push(['select',cols]);
    return {single(){calls.push(['single']);return Promise.resolve(response)}};
   }};
  }};
 }};
 const ctx={db,user:{id:'owner-a'},authRevision:1,editingId:'task-1',busy:false,
  $,areas:{work:'Работа'},priorities:{normal:'Обычный'},
  validDate:date=>date===''||/^\d{4}-\d{2}-\d{2}$/.test(date),
  feedback:message=>messages.push(message),render:()=>{renders++},load:async()=>{loads++}};
 const api=runInNewContext(production+'\n({change,submitTaskEditor})',ctx);
 for(const [id,value] of Object.entries({
  'edit-title':'Synthetic task','edit-area':'work','edit-priority':'normal',
  'edit-status':'todo','edit-due':'2026-10-27','edit-description':'Synthetic details'
 }))$(id).value=value;
 return {api,ctx,$,calls,messages,get renders(){return renders},get loads(){return loads}};
}

test('quick action changes UI only after an owner-scoped row is returned',async()=>{
 const h=harness({data:{id:'task-1'},error:null}),task={id:'task-1',status:'todo'};
 await h.api.change(task,{status:'done'});
 assert.equal(task.status,'done');
 assert.equal(h.renders,1);
 assert.deepEqual(h.calls.slice(1).map(c=>Array.from(c)),[
  ['eq','id','task-1'],['eq','user_id','owner-a'],['select','id'],['single']
 ]);
});

test('RLS denial or deleted task cannot appear as a successful quick action',async()=>{
 for(const response of [{data:null,error:null},{data:null,error:{message:'No matching row'}},{data:{id:'other'},error:null}]){
  const h=harness(response),task={id:'task-1',status:'todo'};
  await h.api.change(task,{status:'done'});
  assert.equal(task.status,'todo');
  assert.equal(h.renders,0);
  assert.match(h.messages.at(-1),/Ошибка:/);
 }
});

test('editor update confirms the owner-scoped row before closing',async()=>{
 const h=harness({data:{id:'task-1'},error:null});
 await h.api.submitTaskEditor({preventDefault(){}});
 assert.equal(h.loads,1);
 assert.equal(h.$('task-editor').classList.contains('hidden'),true);
 assert.match(h.messages.at(-1),/Задача сохранена/);
 assert.deepEqual(h.calls.slice(1).map(c=>Array.from(c)),[
  ['eq','id','task-1'],['eq','user_id','owner-a'],['select','id'],['single']
 ]);
});

test('editor stays open when an update affects no row',async()=>{
 const h=harness({data:null,error:null});
 await h.api.submitTaskEditor({preventDefault(){}});
 assert.equal(h.loads,0);
 assert.equal(h.$('task-editor').classList.contains('hidden'),false);
 assert.match(h.$('edit-note').textContent,/Задача не обновлена/);
 assert.equal(h.ctx.busy,false);
});

test('new task closes editor only after server confirms inserted owner row',async()=>{
 const h=harness({data:{id:'created-1',user_id:'owner-a'},error:null});
 h.ctx.editingId=null;
 await h.api.submitTaskEditor({preventDefault(){}});
 assert.equal(h.loads,1);
 assert.equal(h.$('task-editor').classList.contains('hidden'),true);
 assert.match(h.messages.at(-1),/Задача сохранена/);
 assert.equal(h.ctx.busy,false);
 assert.deepEqual(h.calls.slice(1).map(c=>Array.from(c)),[
  ['select','id,user_id'],['single']
 ]);
 assert.equal(h.calls[0][0],'insert');
 assert.equal(h.calls[0][1].user_id,'owner-a');
});

test('new task stays in editor if insert acknowledgement is missing or belongs to another user',async()=>{
 for(const response of [
  {data:null,error:null},
  {data:{id:'created-1',user_id:'other-user'},error:null},
  {data:{id:'',user_id:'owner-a'},error:null},
  {data:null,error:{message:'RLS rejected insert'}}
 ]){
  const h=harness(response);
  h.ctx.editingId=null;
  await h.api.submitTaskEditor({preventDefault(){}});
  assert.equal(h.loads,0);
  assert.equal(h.$('task-editor').classList.contains('hidden'),false);
  assert.match(h.$('edit-note').textContent,/Не удалось сохранить:/);
  assert.equal(h.ctx.busy,false);
 }
});
