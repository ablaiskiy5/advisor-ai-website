import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function resetDocumentCatalog()'),html.indexOf('function summary('));
function fixture(){
 let settle,renders=0;const filters=[],columns=[];
 const ctx={documentCatalog:{owner:null,state:'idle',cases:new Map()},documentCatalogRevision:0,
  session:{user:{id:'owner-A'}},authRevision:1,page:'documents',active:null,newCaseKind:null,isCloud:()=>true,
  isCurrentWorkspaceSession:(epoch,owner)=>epoch===ctx.authRevision&&ctx.session?.user.id===owner,render:()=>renders++,
  cloud:{from(table){assert.equal(table,'advisor_ai_messages');return {select(value){columns.push(value);return this},eq(k,v){filters.push([k,v]);return this},order(){return this},limit:()=>new Promise(resolve=>settle=resolve)}}}};
 runInNewContext(source,ctx);return {ctx,filters,columns,finish:result=>settle(result),get renders(){return renders}};
}
test('document catalog reads only owned response metadata and groups the latest answer by case',async()=>{
 const f=fixture(),pending=f.ctx.loadDocumentCatalog();f.finish({data:[{case_id:'case-A',created_at:'2026-11-03'},{case_id:'case-A',created_at:'2026-11-02'},{case_id:'case-B',created_at:'2026-11-01'}]});await pending;
 assert.deepEqual(f.columns,['case_id,created_at']);assert.deepEqual(f.filters,[['user_id','owner-A'],['role','assistant']]);assert.equal(f.ctx.documentCatalog.cases.size,2);assert.equal(f.ctx.documentCatalog.cases.get('case-A'),'2026-11-03');assert.equal(f.renders,1);
});
test('late document metadata cannot reappear after changing accounts',async()=>{
 const f=fixture(),pending=f.ctx.loadDocumentCatalog();f.ctx.session={user:{id:'owner-B'}};f.ctx.authRevision++;f.ctx.resetDocumentCatalog();f.finish({data:[{case_id:'old-case',created_at:'2026-11-03'}]});await pending;
 assert.equal(f.ctx.documentCatalog.owner,null);assert.equal(f.ctx.documentCatalog.cases.size,0);assert.equal(f.renders,0);
});
test('failed metadata load exposes recovery instead of presenting history cases as documents',async()=>{
 const f=fixture(),pending=f.ctx.loadDocumentCatalog();f.finish({data:null,error:{message:'Synthetic offline'}});await pending;assert.equal(f.ctx.documentCatalog.state,'error');assert.match(f.ctx.documentCatalog.error,/Обновить материалы/);assert.equal(f.ctx.documentCatalog.cases.size,0);
});
