import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const source=html.match(/function splitPresentationText\(value,maxChars=750\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(source,'Presentation text splitter must exist');
const split=runInNewContext(source+';splitPresentationText');
const samples=[
 '',
 'Краткий инвестиционный отчёт',
 '🙂'.repeat(200),
 'x🙂y'.repeat(400),
 'Первый абзац\nВторой абзац\n\nТретий',
 'longword'.repeat(700)
];
let checked=0;
for(const value of samples)for(const size of [2,3,5,30,750]){
 const parts=split(value,size);
 assert.equal(parts.join(''),value,'Slide export must preserve full report');
 for(const part of parts){
  assert.ok(part.length>0&&part.length<=size,'Chunk size must stay within limit');
  assert.doesNotMatch(part,/[\uD800-\uDBFF]$/,'No broken emoji at slide end');
  assert.doesNotMatch(part,/^[\uDC00-\uDFFF]/,'No broken emoji at slide start');
 }
 checked++;
}
assert.match(html,/if\(sections\.length>40\)throw Error\(/,'Oversize reports must be rejected clearly');
assert.doesNotMatch(html,/Math\.min\(sections\.length,40\)/,'Never silently truncate slides');
console.log('PASS: '+checked+' presentation chunk cases and 2 truncation guards');
