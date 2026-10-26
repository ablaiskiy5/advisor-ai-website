import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../tasks-board.html',import.meta.url),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(inline,'Production task editor script must exist');
const offline=inline.replace(/^init\(\)\.catch\(e=>feedback\('Ошибка: '\+e\.message\)\);\s*$/m,'');
assert.notEqual(offline,inline,'Never connect to production Supabase in unit tests');

function harness(){
 const elements=new Map(),messages=[],loads=[],writes=[];
 let settle;
 const document={getElementById(id){
  if(!elements.has(id)){
   const classes=new Set();
   elements.set(id,{value:'',textContent:'',classList:{
    add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)
   }});
  }
  return elements.get(id);
 }};
 const db={from(table){
  assert.equal(table,'advisor_tasks');
  return {insert(values){
   writes.push(values);
   return {select(columns){
    assert.equal(columns,'id,user_id');
    return {single(){return new Promise(resolve=>{settle=resolve})}};
   }};
  }};
 }};
 const app=runInNewContext(offline+`
  render=()=>{};
  load=async()=>{__loads.push(user?.id)};
  feedback=message=>__messages.push(message);
  ({submitTaskEditor,handleTaskAuthChange,
    setUser:id=>{db=__db;user=id?{id}:null},
    getBusy:()=>busy})
 `,{Date,Intl,document,setTimeout:()=>{},__db:db,__messages:messages,__loads:loads});
 app.setUser('owner-a');
 for(const [id,value] of Object.entries({
  'edit-title':'Synthetic task','edit-area':'work','edit-priority':'normal',
  'edit-status':'todo','edit-due':'2026-10-24','edit-description':'Test only'
 }))document.getElementById(id).value=value;
 return {app,document,messages,loads,writes,
  resolve:value=>{assert.equal(typeof settle,'function');settle(value)},
  submit:()=>app.submitTaskEditor({preventDefault(){}})
 };
}

test('normal editor save stays owner-scoped and refreshes the task list',async()=>{
 const h=harness(),pending=h.submit();
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].user_id,'owner-a');
 h.resolve({data:{id:'created-1',user_id:'owner-a'},error:null});await pending;
 assert.deepEqual(h.loads,['owner-a']);
 assert.match(h.messages.at(-1),/Задача сохранена/);
 assert.equal(h.app.getBusy(),false);
});

test('stale editor success cannot close a different account editor or refresh its tasks',async()=>{
 for(const nextUser of ['owner-b','owner-a']){
  const h=harness(),pending=h.submit();
  h.app.handleTaskAuthChange('SIGNED_OUT',null);
  h.app.setUser(nextUser);
  h.document.getElementById('task-editor').classList.remove('hidden');
  h.document.getElementById('edit-note').textContent='New session editor';
  h.resolve({error:null});await pending;
  assert.equal(h.document.getElementById('task-editor').classList.contains('hidden'),false);
  assert.equal(h.document.getElementById('edit-note').textContent,'New session editor');
  assert.equal(h.loads.length,0);
  assert.ok(!h.messages.some(message=>message.includes('Задача сохранена')));
 }
});

test('stale editor failure does not expose previous session error',async()=>{
 const h=harness(),pending=h.submit();
 h.app.handleTaskAuthChange('SIGNED_OUT',null);
 h.app.setUser('owner-b');
 h.document.getElementById('edit-note').textContent='New session editor';
 h.resolve({error:{message:'Private previous session error'}});await pending;
 assert.equal(h.document.getElementById('edit-note').textContent,'New session editor');
 assert.ok(!h.messages.some(message=>message.includes('Private previous session error')));
});
