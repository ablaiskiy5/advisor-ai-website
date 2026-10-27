import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../tasks-board.html',import.meta.url),'utf8');
const start=html.indexOf('function stopTaskDictation('),end=html.indexOf('function feedback(',start);
assert.ok(start>=0&&end>start,'task voice feature exists');
function harness(supported=true){
 const nodes={brain:{value:'Оплатить счета',readOnly:false},'brain-mic':{disabled:false,textContent:''},'brain-lang':{value:'ru-RU'},'brain-voice-status':{textContent:''}};
 const engines=[];class Fake{
  constructor(){engines.push(this)}
  start(){this.started=true}
  stop(){this.stopped=true}
  abort(){this.aborted=true}
 }
 let owner='owner-A',revision=0;
 const ctx={$:id=>nodes[id],user:{id:'owner-A'},authRevision:0,busy:false,taskVoiceEngine:null,taskVoiceAnchor:'',window:supported?{webkitSpeechRecognition:Fake}:{}};
 const app=runInNewContext(html.slice(start,end)+';({toggleTaskDictation,stopTaskDictation})',ctx);
 return {nodes,engines,app,switchOwner:()=>{ctx.user={id:'owner-B'};ctx.authRevision=1}};
}
test('dictating a brain dump appends text without creating tasks',()=>{
 const h=harness();h.app.toggleTaskDictation();
 assert.equal(h.engines[0].lang,'ru-RU');
 assert.equal(h.nodes.brain.readOnly,true);
 h.engines[0].onresult({results:[[{transcript:'Разобрать портфель'}]]});
 assert.equal(h.nodes.brain.value,'Оплатить счета\nРазобрать портфель');
 h.app.toggleTaskDictation();
 assert.equal(h.nodes.brain.readOnly,false);
});
test('late transcript from another account is ignored',()=>{
 const h=harness();h.app.toggleTaskDictation();h.switchOwner();
 h.engines[0].onresult({results:[[{transcript:'private content'}]]});
 assert.equal(h.nodes.brain.value,'Оплатить счета');
});
test('unsupported browser provides a manual input fallback',()=>{
 const h=harness(false);h.app.toggleTaskDictation();
 assert.match(h.nodes['brain-voice-status'].textContent,/не поддерживает диктовку/);
});
test('task logout aborts mic; AI parse never auto-sends raw microphone stream',()=>{
 assert.match(html,/if\(typeof taskVoiceEngine!=='undefined'&&taskVoiceEngine\)stopTaskDictation\(true\)/);
 assert.match(html,/id="brain-mic"/);
 assert.match(html,/id="brain-voice-status" role="status"/);
 assert.match(html,/if\(typeof taskVoiceEngine!=='undefined'&&taskVoiceEngine\)stopTaskDictation\(\)/);
});
