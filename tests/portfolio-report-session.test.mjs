import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../portfolio-report.html',import.meta.url),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(inline,'Production report script must exist');
const offline=inline.replace(/init\(\)\.catch\(e=>\{\$\('status'\)\.className='error';\$\('status'\)\.textContent=e\.message\}\);\s*$/,'');
assert.notEqual(offline,inline,'Remove automatic browser initializer in test harness');
const uuid='11111111-1111-4111-8111-111111111111';
function harness(database={}){
 const elements=new Map(),classes=new Set(),renders=[];
 const el=id=>{
  if(!elements.has(id))elements.set(id,{textContent:'',className:'',style:{display:''},disabled:false,value:'',href:'',addEventListener(){}});
  return elements.get(id);
 };
 const context={document:{getElementById:el,body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},
  location:{search:'?case='+uuid},URLSearchParams,window:{supabase:{createClient:()=>database}},Date,Intl};
 const app=runInNewContext(offline+`
 renderReport=(data,title)=>{renderedCalls.push({data,title})};
 ({init,handleReportAuthChange,seed:(owner)=>{
  reportOwnerId=owner;exportedRows=[{name:'SYNTHETIC'}];currentPortfolioData={total:100};
  currentInvestmentConclusion='SYNTHETIC PRIVATE CONCLUSION';
  $('report').style.display='block';
  for(const id of reportPrivateIds)$(id).textContent='SYNTHETIC PRIVATE DATA';
  for(const id of ['print','download','copy-conclusion','download-conclusion'])$(id).disabled=false;
 },snapshot:()=>({owner:reportOwnerId,revision:reportAuthRevision,rows:exportedRows,portfolio:currentPortfolioData,conclusion:currentInvestmentConclusion})})
 `,{...context,renderedCalls:renders});
 return {...app,el,classes,renders};
}

test('sign-out clears all report content, export sources, and printable output',()=>{
 const app=harness();app.seed('owner-a');
 app.handleReportAuthChange('SIGNED_OUT',null);
 assert.equal(app.snapshot().owner,null);
 assert.equal(app.snapshot().rows,null);
 assert.equal(app.snapshot().portfolio,null);
 assert.equal(app.snapshot().conclusion,'');
 assert.equal(app.el('report').style.display,'none');
 assert.ok(app.classes.has('report-session-ended'));
 for(const id of ['r-title','r-date','r-rows','r-conclusion','r-nav','scenario-output','conclusion-status'])
  assert.equal(app.el(id).textContent,'',id+' should be empty');
 for(const id of ['print','download','copy-conclusion','download-conclusion'])
  assert.equal(app.el(id).disabled,true);
 assert.match(html,/body\.report-session-ended #report\{display:none!important\}/,'Print CSS must not reveal hidden report');
});

test('token refresh keeps report, account switch removes it',()=>{
 const app=harness();app.seed('owner-a');
 app.handleReportAuthChange('TOKEN_REFRESHED',{user:{id:'owner-a'}});
 assert.equal(app.snapshot().owner,'owner-a');
 assert.equal(app.el('report').style.display,'block');
 app.handleReportAuthChange('SIGNED_IN',{user:{id:'owner-b'}});
 assert.equal(app.snapshot().owner,null);
 assert.equal(app.el('report').style.display,'none');
});

test('late owner-scoped portfolio fetch cannot render after sign-out',async()=>{
 let authCallback,release;
 const filters=[];
 const database={
  auth:{onAuthStateChange:fn=>{authCallback=fn;return {data:{subscription:{unsubscribe(){}}}}},getUser:async()=>({data:{user:{id:'owner-a'}},error:null})},
  from:table=>{
   assert.equal(table,'workspace_items');
   return {select:()=>this,eq(field,value){filters.push([field,value]);return this},single(){return new Promise(resolve=>{release=resolve})}};
  }
 };
 // Use a normal query builder with a chainable select.
 database.from=table=>{
  assert.equal(table,'workspace_items');
  return {select(){return this},eq(field,value){filters.push([field,value]);return this},single(){return new Promise(resolve=>{release=resolve})}};
 };
 const app=harness(database);
 const pending=app.init();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(filters,[['id',uuid],['user_id','owner-a']]);
 authCallback('SIGNED_OUT',null);
 release({data:{kind:'portfolio',title:'SYNTHETIC',notes:'SYNTHETIC'},error:null});
 await pending;
 assert.equal(app.renders.length,0,'Stale fetch must not render');
 assert.equal(app.el('report').style.display,'none');
 assert.equal(app.snapshot().owner,null);
});

test('auth revision blocks delayed getUser result after sign-out',async()=>{
 let authCallback,releaseAuth,queries=0;
 const database={
  auth:{onAuthStateChange:fn=>{authCallback=fn},getUser:()=>new Promise(resolve=>{releaseAuth=resolve})},
  from(){queries++;throw Error('Should not read after sign-out')}
 };
 const app=harness(database),pending=app.init();
 authCallback('SIGNED_OUT',null);
 releaseAuth({data:{user:{id:'owner-a'}},error:null});
 await pending;
 assert.equal(queries,0);
 assert.equal(app.snapshot().owner,null);
});
