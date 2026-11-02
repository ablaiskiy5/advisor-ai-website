import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
test('document creation and main download formats are one click away',()=>{
 const sidebar=html.slice(html.indexOf('<aside class="card info">'),html.indexOf('</aside>'));
 assert.match(sidebar,/Создать документ по кейсу/);
 assert.match(sidebar,/id="quick-docx"/);
 assert.match(sidebar,/id="quick-pdf"/);
 assert.ok(sidebar.indexOf('id="quick-pdf"')<sidebar.indexOf('<details class="chat-sidebar-details chat-exports">'));
});
test('shortcuts call existing tested PDF and DOCX exporters',()=>{
 assert.match(html,/\$\('quick-docx'\)\.addEventListener\('click',downloadDocx\)/);
 assert.match(html,/\$\('quick-pdf'\)\.addEventListener\('click',downloadPdf\)/);
});
test('latest-answer exports stay disabled while a newer saved reply needs recovery',()=>{
 const source=html.slice(html.indexOf('function waiting(v)'),html.indexOf('function isCurrentChat('));
 const nodes={},ctx={lastAnswer:'',pendingAnswerMessageId:null,user:{id:'owner'},caseData:{id:'case'},ready(){},$:id=>nodes[id]??=( {} )};
 runInNewContext(source,ctx);
 for(const [answer,pending,busy,disabled] of [['',null,false,true],['saved',null,false,false],['saved',null,true,true],['older answer','new question',false,true]]){
  ctx.lastAnswer=answer;ctx.pendingAnswerMessageId=pending;ctx.waiting(busy);
  assert.equal(nodes['quick-docx'].disabled,disabled);assert.equal(nodes['quick-pdf'].disabled,disabled);
 }
});
