import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../tasks-board.html',import.meta.url),'utf8');
const start=source.indexOf('function rankTaskProposals(data)');
const end=source.indexOf('function review(data)');
const rank=new Function('areas','priorities','validDate',source.slice(start,end)+';return rankTaskProposals')(
 {work:'Work',personal:'Personal',study:'Study',health:'Health',sport:'Sport',projects:'Projects',other:'Other'},
 {high:'High',normal:'Normal',low:'Low'},
 date=>!date||/^\d{4}-\d{2}-\d{2}$/.test(date)
);
test('AI proposals are grouped by sphere, ranked by priority then deadline',()=>{
 const input=[
  {title:'sports low',area:'sport',priority:'low'},
  {title:'work normal',area:'work',priority:'normal'},
  {title:'work high later',area:'work',priority:'high',due_date:'2026-11-05'},
  {title:'work high sooner',area:'work',priority:'high',due_date:'2026-10-28'},
  {title:'sports high',area:'sport',priority:'high'}
 ];
 assert.deepEqual(rank(input).map(x=>x.title),['work high sooner','work high later','work normal','sports high','sports low']);
 assert.deepEqual(input.map(x=>x.title),['sports low','work normal','work high later','work high sooner','sports high']);
});
test('unknown AI categories fall back to other and proposals remain capped',()=>{
 const input=Array.from({length:31},(_,i)=>({title:'task '+i,area:'unknown',priority:'surprise'}));
 const ordered=rank(input);
 assert.equal(ordered.length,30);
 assert.ok(ordered.every(x=>x.area==='other'&&x.priority==='normal'));
});
test('review headings are not mistaken for selectable tasks',()=>{
 assert.ok(source.includes("for(const div of $('drafts').children)"));
 assert.match(source,/class="draft-group"/);
 assert.match(source,/AI выделил/);
});