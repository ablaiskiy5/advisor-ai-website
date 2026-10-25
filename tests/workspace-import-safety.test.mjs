import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
test('backup import limits size and validates strings',()=>{
 assert.match(page,/data\.length>1000/);
 assert.match(page,/x\.title\.length>180/);
 assert.match(page,/typeof x\[k\]!=='string'/);
});
test('backup import does not spread untrusted object fields into database payload',()=>{
 const fn=page.slice(page.indexOf('async function importData(file)'),page.indexOf("document.addEventListener('click'"));
 assert.doesNotMatch(fn,/\.\.\.x,/);
 assert.match(fn,/const e=\{\.\.\.draft\(x\.kind\),kind:x\.kind,title:x\.title\.trim\(\)/);
});
