import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('async function importHoldingsFile(file){');
const end=html.indexOf('function calculatePortfolio()',start);
assert.ok(start>0&&end>start,'Production portfolio file importer exists');
const source=html.slice(start,end);

function harness(){
 const dom={
  'holdings-input':{value:'initial'},
  'portfolio-preview':{textContent:'initial'},
  'holdings-file':{value:'selected.csv'}
 };
 const ctx={
  authRevision:0,session:{user:{id:'owner-a'}},active:'case-a',
  document:{getElementById:id=>dom[id]||null},
  normalizeHoldingsFile:text=>text.trim(),
  parseHoldings:text=>{
   if(text==='INVALID')throw Error('invalid positions');
   return {rows:[{ticker:'SYNTH'}]};
  },
  summarizeHoldings:()=> 'synthetic summary'
 };
 ctx.isCurrentWorkspaceSession=(revision,ownerId)=>ctx.authRevision===revision&&ctx.session?.user?.id===ownerId;
 const importHoldingsFile=runInNewContext(source+'\nimportHoldingsFile',ctx);
 return {ctx,dom,importHoldingsFile};
}
function deferredFile(){
 let resolve,reject;
 const file={size:100,text:()=>new Promise((yes,no)=>{resolve=yes;reject=no})};
 return {file,resolve:text=>resolve(text),reject:error=>reject(error)};
}

test('normal portfolio file import fills current case and clears file picker',async()=>{
 const h=harness();
 await h.importHoldingsFile({size:100,text:async()=> ' SYNTHETIC '});
 assert.equal(h.dom['holdings-input'].value,'SYNTHETIC');
 assert.match(h.dom['portfolio-preview'].textContent,/Файл прочитан: 1 позиций/);
 assert.equal(h.dom['holdings-file'].value,'');
});

test('late file read cannot populate a different signed-in account',async()=>{
 const h=harness(),d=deferredFile(),pending=h.importHoldingsFile(d.file);
 h.ctx.authRevision++;h.ctx.session={user:{id:'owner-b'}};h.ctx.active='case-b';
 const previous=h.dom['holdings-input'];
 h.dom['holdings-input']={value:'new account data'};
 h.dom['portfolio-preview']={textContent:'new account preview'};
 h.dom['holdings-file']={value:'new.csv'};
 d.resolve('PRIVATE OLD FILE');await pending;
 assert.equal(previous.value,'initial');
 assert.equal(h.dom['holdings-input'].value,'new account data');
 assert.equal(h.dom['portfolio-preview'].textContent,'new account preview');
 assert.equal(h.dom['holdings-file'].value,'new.csv');
});

test('sign-out and same-account re-login invalidate pending file import',async()=>{
 const h=harness(),d=deferredFile(),pending=h.importHoldingsFile(d.file);
 h.ctx.authRevision+=2;h.ctx.session={user:{id:'owner-a'}};
 d.resolve('PRIVATE OLD FILE');await pending;
 assert.equal(h.dom['holdings-input'].value,'initial');
 assert.equal(h.dom['portfolio-preview'].textContent,'initial');
 assert.equal(h.dom['holdings-file'].value,'selected.csv');
});

test('navigating to a different case during file read rejects old import',async()=>{
 const h=harness(),d=deferredFile(),pending=h.importHoldingsFile(d.file);
 h.ctx.active='case-b';
 d.resolve('PRIVATE OLD FILE');await pending;
 assert.equal(h.dom['holdings-input'].value,'initial');
 assert.equal(h.dom['portfolio-preview'].textContent,'initial');
});

test('old file read errors do not display in a new account or clear its picker',async()=>{
 const h=harness(),d=deferredFile(),pending=h.importHoldingsFile(d.file);
 h.ctx.authRevision++;h.ctx.session={user:{id:'owner-b'}};
 h.dom['portfolio-preview']={textContent:'new account preview'};
 h.dom['holdings-file']={value:'new.csv'};
 d.reject(Error('private old error'));await pending;
 assert.equal(h.dom['portfolio-preview'].textContent,'new account preview');
 assert.equal(h.dom['holdings-file'].value,'new.csv');
});

test('invalid file and oversized file still show feedback for current case',async()=>{
 const h=harness();
 await h.importHoldingsFile({size:100,text:async()=> 'INVALID'});
 assert.match(h.dom['portfolio-preview'].textContent,/Ошибка импорта: invalid positions/);
 h.dom['holdings-file'].value='oversized.csv';
 await h.importHoldingsFile({size:50001,text:async()=>{throw Error('should not read')}});
 assert.match(h.dom['portfolio-preview'].textContent,/Максимум 50 КБ/);
});
