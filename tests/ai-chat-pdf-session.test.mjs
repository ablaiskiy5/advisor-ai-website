import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('let pdfExportInProgress='),html.indexOf('function docxRichRuns('));
function fixture(){
 let finish,fail,started,removed=0,urlCount=0,selected;
 const generating=new Promise(resolve=>started=resolve),blob=new Promise((resolve,reject)=>{finish=resolve;fail=reject});
 const downloads=[],nodes={'download-pdf':{disabled:false,textContent:'PDF'},'result-status':{textContent:''}};
 const captureDoc={open(){},write(){},close(){},importNode:node=>node,body:{firstElementChild:{},append(){}},
  createElement:()=>({}),head:{append(script){Promise.resolve().then(()=>script.onload())}}};
 const chain={set(){return this},from(){return this},outputPdf(){started();return blob}};
 const ctx={user:{id:'owner-A'},caseData:{title:'Synthetic report'},sessionEpoch:0,pendingAnswerMessageId:null,
  lastAnswer:'Latest report',working:false,window:{html2pdf(){}},$:id=>nodes[id],
  fileName:()=>ctx.caseData.title,printableContent:answer=>{selected=answer;return {}},
  isCurrentChat:(epoch,owner)=>epoch===ctx.sessionEpoch&&ctx.user?.id===owner&&Boolean(ctx.caseData),
  URL:{createObjectURL(){urlCount++;return 'blob:synthetic'},revokeObjectURL(){}},setTimeout(){return 1},clearTimeout(){},
  document:{body:{append(){}},createElement:tag=>tag==='iframe'?{title:'',style:{},setAttribute(){},remove(){removed++},contentDocument:captureDoc,contentWindow:{html2pdf:()=>chain}}:{click(){downloads.push(this.download)},remove(){}}}};
 runInNewContext(source,ctx);
 return {ctx,nodes,downloads,generating,finish,fail,get removed(){return removed},get selected(){return selected},get urlCount(){return urlCount}};
}
test('PDF captures the selected reply and filename before asynchronous generation',async()=>{
 const f=fixture(),pending=f.ctx.downloadPdf('Selected earlier reply');await f.generating;
 f.ctx.lastAnswer='Changed latest reply';f.ctx.caseData.title='Changed title';f.finish({});await pending;
 assert.equal(f.selected,'Selected earlier reply');assert.deepEqual(f.downloads,['AdvisorAI-Synthetic report.pdf']);assert.equal(f.removed,1);
});
test('sign-out during PDF generation prevents a late private download and clears its frame',async()=>{
 const f=fixture(),pending=f.ctx.downloadPdf();await f.generating;
 f.ctx.sessionEpoch++;f.ctx.user=null;f.ctx.caseData=null;f.nodes['result-status'].textContent='Signed out';
 f.finish({});await pending;
 assert.equal(f.urlCount,0);assert.deepEqual(f.downloads,[]);assert.equal(f.removed,1);assert.equal(f.nodes['result-status'].textContent,'Signed out');
});
test('late PDF error cannot overwrite a new account status',async()=>{
 const f=fixture(),pending=f.ctx.downloadPdf();await f.generating;
 f.ctx.sessionEpoch++;f.ctx.user={id:'owner-B'};f.nodes['result-status'].textContent='New account';
 f.fail(Error('Synthetic old export error'));await pending;
 assert.equal(f.urlCount,0);assert.equal(f.removed,1);assert.equal(f.nodes['result-status'].textContent,'New account');
});
