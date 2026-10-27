import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const start=source.indexOf('function stopDictation('),end=source.indexOf('function setStatus(',start);
assert.ok(start>=0&&end>start,'Dictation implementation must exist');
function harness(compatible=true){
 const nodes={dictate:{textContent:''},'dictation-lang':{value:'ru-RU'},'voice-status':{textContent:''},question:{value:'Текущий текст',readOnly:false}};
 const engines=[];class Recognition{
  constructor(){engines.push(this)}
  start(){this.started=true}
  stop(){this.stopped=true}
  abort(){this.aborted=true}
 }
 let owner='test-owner',epoch=1;
 const ctx={voiceRecognition:null,voiceAnchor:'',user:{id:'test-owner'},caseData:{kind:'portfolio'},working:false,sessionEpoch:1,$:id=>nodes[id],
  isCurrentChat:(e,u)=>e===epoch&&u===owner,window:compatible?{webkitSpeechRecognition:Recognition}:{}};
 const app=runInNewContext(source.slice(start,end)+';({toggleDictation,stopDictation})',ctx);
 return {nodes,engines,app,switchUser:()=>{owner='another-user';epoch++}};
}
test('speech transcription updates a draft, never automatically sends it',()=>{
 const h=harness();h.app.toggleDictation();
 assert.equal(h.engines.length,1);
 assert.equal(h.engines[0].lang,'ru-RU');
 assert.equal(h.nodes.question.readOnly,true);
 h.engines[0].onresult({results:[[{transcript:'Проверь риски портфеля'}]]});
 assert.equal(h.nodes.question.value,'Текущий текст Проверь риски портфеля');
 h.app.toggleDictation();
 assert.equal(h.nodes.question.readOnly,false);
 assert.match(h.nodes['voice-status'].textContent,/Диктовка остановлена/);
});
test('late voice transcript from previous account is ignored',()=>{
 const h=harness();h.app.toggleDictation();h.switchUser();
 h.engines[0].onresult({results:[[{transcript:'ПРИВАТНО'}]]});
 assert.equal(h.nodes.question.value,'Текущий текст');
});
test('unsupported browser gets clear fallback',()=>{
 const h=harness(false);h.app.toggleDictation();
 assert.match(h.nodes['voice-status'].textContent,/диктовка недоступна/);
 assert.equal(h.engines.length,0);
});
test('dictation is user initiated, visually distinct, and can be aborted on logout',()=>{
 assert.match(source,/id="dictate"/);
 assert.match(source,/id="voice-status" role="status"/);
 assert.match(source,/voiceRecognition\)stopDictation\(true\)/);
 assert.match(source,/navigator\.clipboard\.writeText/);
});
