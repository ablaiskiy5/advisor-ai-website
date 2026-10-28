import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/workspace-drafts.js',import.meta.url),'utf8');
function harness(store=new Map(),blocked=false){
 const nodes={text:{id:'text',type:'textarea',value:'',insertAdjacentElement(){}},password:{type:'password',value:'secret'},file:{type:'file',value:'private-file'}};
 const events={};
 const storage={getItem:k=>store.get(k)||null,setItem(k,v){if(blocked)throw Error('denied');store.set(k,v)},removeItem:k=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size}};
 const window={addEventListener:(name,fn)=>events[name]=fn};
 const document={getElementById:id=>nodes[id]||null,addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({setAttribute(){}})};
 runInNewContext(source,{window,document,sessionStorage:storage,Date,Map,JSON,encodeURIComponent});
 return{api:window.AdvisorDrafts,nodes,store,events,window};
}
test('typed and programmatic input survives reload for same owner/case only',()=>{
 const h=harness();h.api.bind('a','chat:1',['text']);h.nodes.text.value='Synthetic question';h.events.input({target:{id:'text'}});
 const next=harness(h.store);next.api.bind('b','chat:1',['text']);assert.equal(next.nodes.text.value,'');
 next.api.bind('a','chat:2',['text']);assert.equal(next.nodes.text.value,'');
 next.api.bind('a','chat:1',['text']);assert.equal(next.nodes.text.value,'Synthetic question');
 next.nodes.text.value='Dictated text';next.events.pagehide();
 const third=harness(h.store);third.api.bind('a','chat:1',['text']);assert.equal(third.nodes.text.value,'Dictated text');
});
test('logout purge removes private drafts but leaves unrelated browser settings',()=>{
 const h=harness();h.store.set('theme','light');h.api.bind('a','case:1',['text']);h.nodes.text.value='private draft';h.api.capture();h.api.purge();h.events.pagehide();
 assert.deepEqual([...h.store],[['theme','light']]);
 h.nodes.text.value='';h.api.bind('a','case:1',['text']);assert.equal(h.nodes.text.value,'');
});
test('successful send/save acknowledgement prevents resurrection of sent text',()=>{
 const h=harness();h.api.bind('a','chat:1',['text']);h.nodes.text.value='Question';h.api.capture();h.nodes.text.value='';h.api.acknowledge(['text']);assert.equal(h.store.size,0);
});
test('only explicit text controls persist; passwords and file inputs are excluded',()=>{
 const h=harness();h.api.bind('a','case:1',['text','password','file']);h.nodes.text.value='Safe synthetic input';h.nodes.password.value='changed-secret';h.nodes.file.value='changed-file';h.api.capture();
 const data=JSON.parse([...h.store.values()][0]);assert.deepEqual(data.fields,{text:'Safe synthetic input'});
});
test('expired, malformed and wrong-owner payloads are discarded',()=>{
 for(const raw of ['{',JSON.stringify({owner:'a',scope:'x',time:Date.now()-13*3600000,fields:{text:'old'}}),JSON.stringify({owner:'b',scope:'x',time:Date.now(),fields:{text:'foreign'}})]){
  const h=harness(new Map([['advisor-input-draft-v1:a:x',raw]]));h.api.bind('a','x',['text']);assert.equal(h.nodes.text.value,'');assert.equal(h.store.size,0);
 }
});
test('storage failure retains in-tab copy and warns before page exit',()=>{
 const h=harness(new Map(),true);h.api.bind('a','x',['text']);h.nodes.text.value='Unsaved';assert.equal(h.api.capture(),false);
 let prevented=false;h.events.beforeunload({preventDefault(){prevented=true}});assert.equal(prevented,true);
 h.nodes.text.value='';h.api.bind('a','x',['text']);assert.equal(h.nodes.text.value,'Unsaved');
});
test('pending files, AI requests and unapproved task cards trigger exit warning',()=>{
 const h=harness();let prevented=false;h.window.workspaceHasTransientWork=()=>true;h.events.beforeunload({preventDefault(){prevented=true}});assert.equal(prevented,true);
});
test('oversized draft is not silently truncated or claimed persisted',()=>{
 const h=harness();h.api.bind('a','x',['text']);h.nodes.text.value='x'.repeat(250001);assert.equal(h.api.capture(),false);assert.equal(h.store.size,0);assert.equal(h.nodes.text.value.length,250001);
});
test('an acknowledged older save keeps edits typed while the request was in flight',()=>{
 const h=harness();h.api.bind('a','case:1',['text']);h.nodes.text.value='First edit';h.api.capture();
 h.nodes.text.value='Newer edit';h.api.acknowledge(['text'],{text:'First edit'});
 const next=harness(h.store);next.nodes.text.value='First edit';next.api.bind('a','case:1',['text']);assert.equal(next.nodes.text.value,'Newer edit');
});
