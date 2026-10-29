// Real PDF generation from production exporter with synthetic data only.
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const html=await readFile('ai-chat.html','utf8');
const styles=html.match(/<style>([\s\S]*?)<\/style>/)[1]+'\n'+await readFile('assets/workspace-shell.css','utf8');
const printable=html.slice(html.indexOf('function printableContent('),html.indexOf('// Preserve every character'));
const pdf=html.slice(html.indexOf('let pdfExportInProgress='),html.indexOf('function docxRichRuns('));
const renderer=await readFile('assets/answer-renderer.js','utf8');
const bundle=await readFile('node_modules/html2pdf.js/dist/html2pdf.bundle.min.js','utf8');
const out=resolve(process.env.ADVISOR_QA_DIR||'/tmp/advisor-pdf-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.ADVISOR_CHROMIUM_PATH||undefined,args:process.env.ADVISOR_CHROMIUM_PATH?['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']:[]});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  await page.route('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js',route=>route.fulfill({contentType:'text/javascript',body:bundle}));
  await page.setContent('<!doctype html><html><head><style>'+styles+'</style></head><body class="has-workspace-shell"><div id="workspace-shell">Synthetic navigation</div><div style="height:1800px">Synthetic prior conversation</div><button id="download-pdf">PDF</button><p id="result-status"></p><div style="height:900px"></div></body></html>');
  await page.addScriptTag({content:bundle});await page.addScriptTag({content:renderer});
  const answer=['## LEFT_EDGE_MARKER Portfolio review','Complete synthetic report with dates, risks and conditional scenarios. RIGHT_EDGE_MARKER',
   '| LEFT_COLUMN | Instrument | Value USD | RIGHT_COLUMN |\n| --- | --- | --- | --- |\n| LEFT_CELL | SYNTH | 123456.78 | RIGHT_CELL |',
   ...Array.from({length:45},(_,i)=>'Paragraph '+(i+1)+'. Полный текст синтетического отчёта. Проверяем, что начало и конец строки, таблицы и последние разделы попадают в PDF без обрезки. The complete line must remain visible.'),
   '## FINAL_SECTION_MARKER','END_OF_REPORT_MARKER - no truncation.'].join('\n\n');
  await page.addScriptTag({content:'const caseData={title:"Synthetic report"},lastAnswer='+JSON.stringify(answer)+';let working=false;const $=id=>document.getElementById(id);function fileName(){return "synthetic"}\n'+printable+'\n'+pdf+'\ndocument.getElementById("download-pdf").onclick=()=>downloadPdf();'});
  await page.evaluate(()=>window.scrollTo(0,1400));
  const download=page.waitForEvent('download');await page.locator('#download-pdf').click();
  const result=await download.catch(async e=>{throw Error((await page.locator('#result-status').textContent())+'; '+e.message)});await result.saveAs(resolve(out,'report-'+width+'.pdf'));
  const bytes=await readFile(resolve(out,'report-'+width+'.pdf'));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>=3,'Long report must span multiple PDF pages');
  assert.equal(await page.locator('#result-status').textContent(),'PDF сохранён. Проверь его перед отправкой клиенту.');
  assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('has-workspace-shell')),true,'Capture reset must not mutate actual shell');
  await page.close();
 }
 console.log('PASS: real PDF downloads at desktop/mobile sizes after scrolling, using production exporter and actual html2pdf. Output: '+out);
}finally{await browser.close()}
