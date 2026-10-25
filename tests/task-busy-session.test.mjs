import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tasks-board.html',import.meta.url),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(inline,'Task-board inline JavaScript must exist');
const offline=inline.replace(/^init\(\)\.catch\(e=>feedback\('Ошибка: '\+e\.message\)\);\s*$/m,'');
assert.notEqual(offline,inline,'Never initialize production Supabase in tests');

function harness(){
 const elements=new Map(),aiRequests=[],saves=[];
 const document={getElementById(id){
  if(!elements.has(id)){
   const classes=new Set();
   elements.set(id,{value:'',textContent:'',disabled:false,children:[],
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)}});
  }
  return elements.get(id);
 }};
 const db={
  functions:{invoke(){return new Promise(resolve=>aiRequests.push(resolve))}},
  from(table){assert.equal(table,'advisor_tasks');return {insert(){return new Promise(resolve=>saves.push(resolve))}}}
 };
 const setup="\nrender=()=>{};review=()=>{};feedback=()=>{};load=async()=>{};\n"+
  "({organize,saveDrafts,submitTaskEditor,handleTaskAuthChange,\n"+
  "setUser:id=>{db=__db;user=id?{id}:null},\n"+
  "setProposals:data=>{proposals=data},\n"+
  "getBusy:()=>busy,getEpoch:()=>authRevision})";
 const app=runInNewContext(offline+setup,{Date,Intl,document,setTimeout:()=>{},__db:db});
 app.setUser('owner-a');
 document.getElementById('brain').value='Synthetic task only';
 for(const [id,value] of Object.entries({
  'edit-title':'Synthetic task','edit-area':'work','edit-priority':'normal',
  'edit-status':'todo','edit-due':'2026-10-24','edit-description':'Synthetic only'
 }))document.getElementById(id).value=value;
 document.getElementById('drafts').children=[{
  dataset:{index:'0'},
  querySelector:selector=>{
   const field=selector.match(/^\[data-field="([^"]+)"\]$/)?.[1];
   const fields={include:{checked:true},title:{value:'Synthetic proposal'},
    area:{value:'work'},priority:{value:'normal'},due_date:{value:'2026-10-25'},description:{value:'Reviewed synthetic details'}};
   assert.ok(fields[field],selector);return fields[field];
  }
 }];
 app.setProposals([{description:'Synthetic details'}]);
 return {app,document,aiRequests,saves};
}
function finishAI(h,index){
 assert.equal(typeof h.aiRequests[index],'function','AI request must be pending');
 h.aiRequests[index]({data:{tasks:[{title:'Synthetic task'}]},error:null});
}
for(const relogin of ['owner-b','owner-a']){
 test('stale AI completion cannot unlock new '+relogin+' session',async()=>{
  const h=harness(),old=h.app.organize();
  assert.equal(h.app.getBusy(),true);
  assert.equal(h.document.getElementById('organize').disabled,true);
  const oldEpoch=h.app.getEpoch();
  h.app.handleTaskAuthChange('SIGNED_OUT',null);
  assert.ok(h.app.getEpoch()>oldEpoch);
  assert.equal(h.app.getBusy(),false,'Sign-out releases old busy state');
  assert.equal(h.document.getElementById('organize').disabled,false);
  h.app.setUser(relogin);
  h.document.getElementById('brain').value='Synthetic task only';
  const fresh=h.app.organize();
  assert.equal(h.aiRequests.length,2,'New session can start while old request is pending');
  finishAI(h,0);await old;
  assert.equal(h.app.getBusy(),true,'Old finally cannot unlock new operation');
  assert.equal(h.document.getElementById('organize').disabled,true);
  finishAI(h,1);await fresh;
  assert.equal(h.app.getBusy(),false);
  assert.equal(h.document.getElementById('organize').disabled,false);
 });
}
test('stale batch-save completion cannot clear new AI busy state',async()=>{
 const h=harness(),old=h.app.saveDrafts();
 assert.equal(h.saves.length,1);
 h.app.handleTaskAuthChange('SIGNED_OUT',null);
 assert.equal(h.document.getElementById('save-drafts').disabled,false);
 h.app.setUser('owner-b');
 h.document.getElementById('brain').value='Synthetic task only';
 const fresh=h.app.organize();
 assert.equal(h.aiRequests.length,1);
 h.saves[0]({error:null});await old;
 assert.equal(h.app.getBusy(),true);
 assert.equal(h.document.getElementById('organize').disabled,true);
 finishAI(h,0);await fresh;
 assert.equal(h.app.getBusy(),false);
});
test('stale editor-save completion cannot clear new AI busy state',async()=>{
 const h=harness(),old=h.app.submitTaskEditor({preventDefault(){}});
 assert.equal(h.saves.length,1);
 h.app.handleTaskAuthChange('SIGNED_OUT',null);
 h.app.setUser('owner-b');
 h.document.getElementById('brain').value='Synthetic task only';
 const fresh=h.app.organize();
 h.saves[0]({error:null});await old;
 assert.equal(h.app.getBusy(),true);
 assert.equal(h.document.getElementById('organize').disabled,true);
 finishAI(h,0);await fresh;
 assert.equal(h.app.getBusy(),false);
});
