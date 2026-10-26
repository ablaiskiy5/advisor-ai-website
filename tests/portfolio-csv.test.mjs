import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../portfolio-report.html',import.meta.url),'utf8');
const start=html.indexOf('function csvSafeCell(');
const end=html.indexOf("$('download').addEventListener",start);
assert.ok(start>=0&&end>start,'CSV safety function must exist');
const csvSafeCell=new Function(html.slice(start,end)+';return csvSafeCell;')();
test('spreadsheet formulas cannot execute from user-supplied names',()=>{
 for(const value of ['=1+1',' +SUM(A1:A3)','-2+3','@HYPERLINK("https://example.com")','\t=1+1','\r=1+1']){
  assert.equal(csvSafeCell(value),'"\''+value.replace(/"/g,'""')+'"');
 }
});
test('invisible Unicode padding cannot hide spreadsheet formulas in exported names',()=>{
 for(const value of ['\u00AD=1+1','\u200E=1+1','\u202E+2','\u2066@SUM(A1)','\u2069-1+2','\u200B=1+1','\u200C+2','\u200D@SUM(A1)','\u2060-1+2','\u200B\u2060 =1+1','\uFEFF\u200B=2+2']){
  assert.equal(csvSafeCell(value),'"\''+value+'"','Unsafe invisible formula prefix: '+JSON.stringify(value));
 }
 assert.equal(csvSafeCell('\u200BОбычная акция'),'"\u200BОбычная акция"');
});

test('CSV separators, quotes and newlines are escaped',()=>{
 assert.equal(csvSafeCell('BOND;"Corp"\nSeries A'),'"BOND;""Corp""\nSeries A"');
 assert.equal(csvSafeCell('NVDA'),'"NVDA"');
});
test('real portfolio CSV export applies escaping to security names',()=>{
 assert.match(html,/\[csvSafeCell\(r\.name\),r\.bond/);
});
