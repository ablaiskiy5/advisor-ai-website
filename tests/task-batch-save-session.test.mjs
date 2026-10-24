import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../tasks-board.html',import.meta.url),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(inline,'Production task-board script must exist');
const offline=inline.replace(/^init\(\)\.catch\(e=>feedback\('Ошибка: '\+e\.message\)\);\s*$/m,'');
assert.notEqual(offline,inline,'Unit tests must never initialize production Supabase');

function harness(){
 const elements=new Map(),messages=[],loads=[],writes=[];
 let settle;
 const document={getElementById(id){
  if(!elements.has(id)){
   const classes=new Set();
   elements.set(id,{value:'',textContent:'',disabled:false,children:[],
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)}});
  }
  return elements.get(id);
 }};
 const inputs={
  include:{checked:true},title:{value:'Synthetic proposal'},
  area:{value:'work'},priority:{value:'high'},due_date:{value:'2026-10-25'}
 };
 document.getElementById('drafts').children=[{
  dataset:{index:'0'},
  querySelector:selector=>{
   const field=selector.match(/^\[data-field="([^"]+)"\]$/)?.[1];
   assert.ok(field&&inputs[field],'Unknown draft field: '+selector);
   return inputs[field];
  }
 }];
 const db={from(table){
  assert.equal(table,'advisor_tasks');
  return {insert(rows){
   writes.push(rows);
   return new Promise(resolve=>{settle=resolve});
  }};
 }};
 const app=runInNewContext(offline+`
  render=()=>{};
  load=async()=>{__loads.push(user?.id)};
  feedback=message=>__messages.push(message);
  ({saveDrafts,handleTaskAuthChange,
    setUser:id=>{db=__db;user=id?{id}:null},
    setProposals:data=>{proposals=data}})
 `,{Date,Intl,document,setTimeout:()=>{},__db:db,__loads:loads,__messages:messages});
 app.setUser('owner-a');
 app.setProposals([{description:'Synthetic details'}]);
 document.getElementById('brain').value='Old account note';
 return {app,document,messages,loads,writes,
  resolve:value=>{assert.equal(typeof settle,'function');settle(value)}
 };
}

test('normal AI proposal save writes only the authenticated owner and refreshes',async()=>{
 const h=harness(),pending=h.app.saveDrafts();
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].length,1);
 assert.equal(h.writes[0][0].user_id,'owner-a');
 h.resolve({error:null});await pending;
 assert.deepEqual(h.loads,['owner-a']);
 assert.equal(h.document.getElementById('brain').value,'');
 assert.equal(h.document.getElementById('review').classList.contains('hidden'),true);
 assert.match(h.messages.at(-1),/Сохранено: 1/);
});

test('late batch-save success cannot clear another session draft or review',async()=>{
 for(const nextId of ['owner-b','owner-a']){
  const h=harness(),pending=h.app.saveDrafts();
  h.app.handleTaskAuthChange('SIGNED_OUT',null);
  h.app.setUser(nextId);
  h.document.getElementById('brain').value='New session note';
  h.document.getElementById('review').classList.remove('hidden');
  h.resolve({error:null});await pending;
  assert.equal(h.document.getElementById('brain').value,'New session note');
  assert.equal(h.document.getElementById('review').classList.contains('hidden'),false);
  assert.deepEqual(h.loads,[]);
  assert.ok(!h.messages.some(m=>m.includes('Сохранено: 1')));
 }
});

test('late batch-save failure cannot display previous account error',async()=>{
 const h=harness(),pending=h.app.saveDrafts();
 h.app.handleTaskAuthChange('SIGNED_OUT',null);
 h.app.setUser('owner-b');
 h.resolve({error:{message:'Private previous-session error'}});await pending;
 assert.ok(!h.messages.some(m=>m.includes('Private previous-session error')));
});

test('batch save without an authenticated owner does not write',async()=>{
 const h=harness();h.app.setUser(null);
 await h.app.saveDrafts();
 assert.equal(h.writes.length,0);
 assert.match(h.messages.at(-1),/Сначала войди/);
});
