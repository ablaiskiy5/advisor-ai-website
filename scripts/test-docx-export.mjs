#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import * as docx from 'docx';
const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const start=html.indexOf('function docxRichRuns(');
const end=html.indexOf('async function downloadDocx(',start);
assert.ok(start>=0&&end>start,'Actual DOCX parser must exist');
const {docxParagraphs}=new Function(html.slice(start,end)+';return {docxParagraphs};')();
const sample=[
 '# Инвестиционный обзор',
 '**Лимит всего пула:** $100 000',
 '- Отдельная идея: NVDA',
 '- Отдельная идея: AMZN',
 '| Инструмент | Сумма USD | Доля |',
 '| --- | ---: | ---: |',
 '| NVDA | 25000 | 2.5% |',
 '| AMZN | 25000 | 2.5% |',
 '## Риски',
 'Результат <script>alert("test")</script> должен остаться буквальным текстом.'
].join('\n');
const paragraphs=docxParagraphs(sample,docx);
assert.ok(paragraphs.length>=5,'Expected full report content');
assert.ok(paragraphs.some(x=>x instanceof docx.Table),'Expected actual table');
const wide='| '+Array.from({length:13},(_,i)=>'C'+i).join(' | ')+' |\n|'+Array(13).fill('---').join('|')+'|\n|'+Array(13).fill('123').join('|')+'|';
assert.throws(()=>docxParagraphs(wide,docx),/12 столбцов/,'Never silently truncate wide tables');
const document=new docx.Document({creator:'Advisor AI',sections:[{children:[
 new docx.Paragraph({text:'Advisor AI',heading:docx.HeadingLevel.TITLE}),...paragraphs
]}]});
const buffer=await docx.Packer.toBuffer(document);
assert.ok(buffer.byteLength>1000,'Export must generate real ZIP bytes');
const dir=mkdtempSync(join(tmpdir(),'advisor-docx-'));
const path=join(dir,'test.docx');
try{
 writeFileSync(path,buffer);
 const xml=execFileSync('unzip',['-p',path,'word/document.xml'],{encoding:'utf8'});
 const types=execFileSync('unzip',['-p',path,'[Content_Types].xml'],{encoding:'utf8'});
 for(const phrase of ['Инвестиционный обзор','NVDA','AMZN','100 000','script','Риски']){
  assert.ok(xml.includes(phrase),'Missing report text: '+phrase);
 }
 assert.ok(xml.includes('<w:tbl>'),'Missing real Word table XML');
 assert.ok(xml.includes('Heading1'),'Missing heading style');
 assert.ok(types.includes('wordprocessingml.document.main+xml'),'Not a real DOCX document');
 console.log('PASS: real DOCX ZIP, heading, table, figures, safe literal text and wide-table rejection');
}finally{rmSync(dir,{recursive:true,force:true})}
