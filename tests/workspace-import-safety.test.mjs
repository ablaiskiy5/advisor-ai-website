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

test('markets disclose quote freshness limits on list and case screens',()=>{
 const inline=page.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
 assert.ok(inline,'Workspace inline script exists');
 assert.doesNotThrow(()=>new Function(inline),'Workspace JavaScript parses');
 assert.match(page,/function marketDataNotice\(\)/);
 assert.match(page,/котировки здесь не обновляются автоматически/);
 assert.match(page,/первоисточник/);
 assert.match(page,/k==='markets'\?marketDataNotice\(\):''/);
 assert.match(page,/e\.kind==='markets'\?marketDataNotice\(\):''/);
});
