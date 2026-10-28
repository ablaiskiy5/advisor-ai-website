import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const s=readFileSync(new URL('../assets/answer-renderer.js',import.meta.url),'utf8');
const begin=s.indexOf('function safeCitedUrl('),end=s.indexOf('function renderAnswerSafe(');
assert.ok(begin>0&&end>begin);
function render(text){
 const nodes=[];
 const root={append(v){nodes.push(v)}};
 const document={
  createElement(tag){return {tag,textContent:'',href:'',target:'',rel:''}},
  createTextNode(value){return {tag:'#text',textContent:value}}
 };
 const renderInlineSafe=runInNewContext(s.slice(begin,end)+';renderInlineSafe',{URL,document});
 renderInlineSafe(root,text);return nodes;
}
test('inline source links are readable, HTTPS-only and open safely',()=>{
 const nodes=render('Источник: [SEC](https://www.sec.gov/edgar/search/) и **важное**.');
 const a=nodes.find(n=>n.tag==='a');
 assert.equal(a.textContent,'SEC');assert.equal(a.href,'https://www.sec.gov/edgar/search/');
 assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer');
 assert.equal(nodes.find(n=>n.tag==='strong')?.textContent,'важное');
});
test('untrusted markup and javascript link syntax remain plain text',()=>{
 const nodes=render('<img src=x onerror=alert(1)> [bad](javascript:alert(1))');
 assert.ok(nodes.every(n=>n.tag==='#text'));
 assert.match(nodes.map(n=>n.textContent).join(''),/javascript:alert/);
 assert.match(nodes.map(n=>n.textContent).join(''),/<img/);
});
test('credentialed links never become clickable and code stays code',()=>{
 const nodes=render('[unsafe](https://evil:password@example.com/x) `duration`');
 assert.equal(nodes.some(n=>n.tag==='a'),false);
 assert.equal(nodes.find(n=>n.tag==='code')?.textContent,'duration');
});
