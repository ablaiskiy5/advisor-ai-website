import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 assert.match(html,/\$\('quick-docx'\)\.disabled=v\|\|!lastAnswer/);
 assert.match(html,/\$\('quick-pdf'\)\.disabled=v\|\|!lastAnswer/);
});
