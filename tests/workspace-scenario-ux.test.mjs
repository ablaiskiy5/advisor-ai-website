import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('const workspaceJourneys='),end=html.indexOf('const statuses=',start);
assert.ok(start>=0&&end>start);
const section={
 portfolio:{prompt:'portfolio',label:'Портфели'},
 ideas:{prompt:'ideas',label:'Идеи'},
 academy:{prompt:'academy',label:'Обучение'},
 markets:{prompt:'markets',label:'Рынки'}
};
const code=html.slice(start,end);
const el=runInNewContext(code+';({workspaceJourneys,journeyDefaults,journeyPanel,startWorkspaceFlow})',{section});
test('each main section offers a distinct pair of work journeys',()=>{
 const entries=Object.entries(el.workspaceJourneys);
 assert.equal(entries.length,4);
 for(const [kind,config] of entries){assert.equal(config.actions.length,2);assert.notEqual(config.actions[0].flow,config.actions[1].flow);assert.match(el.journeyPanel(kind),/data-action="startflow"/);assert.ok(config.actions.every(a=>el.journeyDefaults[kind+':'+a.flow]))}
 assert.match(el.journeyPanel('portfolio'),/скриншот или PDF/);
 assert.match(el.journeyPanel('academy'),/Тренировать аттестацию/);
});
test('missing workbench script falls back to an owned case and chat',async()=>{
 const saved=[],window={location:{assign:url=>saved.push(['url',url])}};
 let writes=0;
 const app=runInNewContext(code+`;({startWorkspaceFlow})`,{section,window,document:{getElementById:()=>null},newCaseKind:null,active:null,page:'home',authRevision:0,session:{user:{id:'owner-1'}},isCloud:()=>true,
  draft:kind=>({id:'case-id',kind,prompt:section[kind].prompt,title:''}),persist:async e=>{writes++;saved.push(['case',e]);return true},
  isCurrentWorkspaceSession:()=>true,render:()=>{},toast:()=>{},Date});
 await app.startWorkspaceFlow('ideas','sector');
 assert.equal(writes,1);
 assert.equal(saved[0][1].kind,'ideas');
 assert.match(saved[0][1].prompt,/сектор/);
 assert.equal(saved[1][1],'./ai-chat.html?case=case-id');
});
test('portfolio positions open calculator in case without another creation form',async()=>{
 let focused=0,assigned=0;
 const app=runInNewContext(code+`;({startWorkspaceFlow})`,{section,window:{location:{assign:()=>assigned++}},document:{getElementById:id=>id==='holdings-input'?{scrollIntoView(){focused++},focus(){focused++}}:null},newCaseKind:null,active:null,page:'home',authRevision:0,session:{user:{id:'owner-1'}},isCloud:()=>true,
  draft:kind=>({id:'portfolio-id',kind,prompt:'portfolio'}),persist:async()=>true,
  isCurrentWorkspaceSession:()=>true,render:()=>{},toast:()=>{},Date});
 await app.startWorkspaceFlow('portfolio','positions');
 assert.equal(assigned,0);assert.equal(focused,2);
});
test('case configuration is secondary and workspace uses light scenario cards',()=>{
 assert.match(html,/class="case-advanced"/);
 assert.match(html,/\.home-journeys\{display:grid/);
 assert.match(html,/\.journey-actions\{display:grid/);
 assert.match(html,/color-scheme:light/);
});

test('supported workbenches open locally without creating empty cases or navigating to chat',async()=>{
 let opened='',writes=0,navigated=0,rendered=0;
 const app=runInNewContext(code+';({startWorkspaceFlow})',{section,AdvisorWorkbench:{supports:()=>true,open:(kind,flow)=>opened=kind+':'+flow},isCloud:()=>true,document:{getElementById:()=>null},window:{location:{assign:()=>navigated++}},active:null,newCaseKind:null,page:'home',persist:async()=>writes++,render:()=>rendered++,toast(){}});
 await app.startWorkspaceFlow('ideas','company');assert.equal(opened,'ideas:company');assert.equal(writes,0);assert.equal(navigated,0);assert.equal(rendered,1);
});
