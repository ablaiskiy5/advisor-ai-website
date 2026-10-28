import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const shell=readFileSync(new URL('../assets/workspace-shell.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/workspace-shell.css',import.meta.url),'utf8');
test('every workspace tool loads the same navigation and leaves a fallback',()=>{
 for(const file of ['workspace','ai-chat','portfolio-report','tasks-board','bond-analysis','ideas-risk-budget','tools-health']){
  const source=readFileSync(new URL('../'+file+'.html',import.meta.url),'utf8');
  assert.equal(source.match(/src="\.\/assets\/workspace-shell.js"/g)?.length,1,file);
  assert.match(source,/href="\.\/assets\/workspace-shell.css"/);
 }
 assert.match(css,/@media print/);assert.match(css,/\.has-workspace-shell a\.workspace-dock/);
 new Function(shell);
});
test('known section deep links survive login while invalid and auth fragments fall back to Home',()=>{
 const start=html.indexOf('window.workspaceCurrentSection='),end=html.indexOf("document.querySelectorAll('#nav button').forEach(b=>b.addEventListener",start);
 const window={location:{hash:'#documents',pathname:'/advisor-ai-website/workspace.html'},history:{replaceState(...args){this.args=args}},addEventListener(){}};
 let selected;
 runInNewContext(html.slice(start,end),{window,page:'home',nav:p=>selected=p});
 assert.equal(window.workspaceRequestedSection(),'documents');
 for(const hash of ['#portfolio','#ideas','#markets','#academy','#history','#settings','#assistant']){window.location.hash=hash;assert.equal(window.workspaceRequestedSection(),hash.slice(1))}
 for(const hash of ['#access_token=private','#unknown','#<script>','']){window.location.hash=hash;assert.equal(window.workspaceRequestedSection(),'home')}
 window.navigateWorkspace('portfolio');assert.equal(selected,'portfolio');assert.equal(window.history.args[2],'/advisor-ai-website/workspace.html#portfolio');
});
test('history and document hubs use existing saved cases and escape search text',()=>{
 const start=html.indexOf('function workspaceHub('),end=html.indexOf('function summary(',start);
 const ctx={pageTitle:(a,b)=>a+b,order:xs=>xs,entries:[{title:'Synthetic portfolio',kind:'portfolio',notes:'note'}],needle:'synthetic',section:{portfolio:{label:'Портфели'}},itemRow:x=>'CASE:'+x.title,esc:s=>s.replaceAll('"','&quot;')};
 const app=runInNewContext(html.slice(start,end)+';({workspaceHub})',ctx);
 assert.match(app.workspaceHub('history'),/CASE:Synthetic portfolio/);
 assert.match(app.workspaceHub('documents'),/Word, PDF или PowerPoint/);
 ctx.needle='unmatched';assert.match(app.workspaceHub('history'),/Ничего не найдено/);
 ctx.needle='"';assert.match(app.workspaceHub('history'),/value="&quot;"/);
});
