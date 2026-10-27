import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const begin=html.indexOf('function renderInlineSafe('),end=html.indexOf('function bubble(role,content)');
assert.ok(begin>=0&&end>begin);
const renderer=html.slice(begin,end);
function render(markdown){
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.className='';this.textContent=''}
  append(...nodes){this.children.push(...nodes)}
  get lastElementChild(){return [...this.children].reverse().find(x=>x instanceof Node)||null}
  get classList(){return {contains:name=>this.className.split(' ').includes(name)}}
 }
 const document={createElement:tag=>new Node(tag),createTextNode:value=>({text:String(value)})};
 const root=new Node('div');
 runInNewContext(renderer+';renderAnswerSafe(root,markdown)',{document,root,markdown});
 return root;
}
test('AI reply uses legible semantic headings, lists and paragraphs',()=>{
 const root=render('## Краткий вывод\nДва предложения.\n\n- Сократить концентрацию\n- Увеличить диверсификацию\n\n1. Первый шаг\n2. Второй шаг');
 assert.deepEqual(root.children.map(x=>x.tagName),['H2','P','UL','OL']);
 assert.equal(root.children[2].children.length,2);
 assert.equal(root.children[3].children.length,2);
});
test('malicious model HTML stays plain text',()=>{
 const root=render('## Вывод\n<script>alert(1)</script>\n- **Выделение** \`фрагмент\`');
 assert.deepEqual(root.children.map(x=>x.tagName),['H2','P','UL']);
 assert.match(JSON.stringify(root),/script/);
 assert.equal(root.children[2].children[0].tagName,'LI');
 assert.doesNotMatch(renderer,/innerHTML\s*=/);
});
test('light reading surface is present with accessible structure',()=>{
 assert.match(html,/\.bubble\.assistant\{color:#253348;background:#fff/);
 assert.match(html,/\.bubble\.assistant \.rendered \.answer-list/);
 assert.match(html,/color-scheme:light/);
});
