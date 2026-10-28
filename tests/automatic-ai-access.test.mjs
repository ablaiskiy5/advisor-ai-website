import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,existsSync,readdirSync}from'node:fs';import{runInNewContext}from'node:vm';
const root=new URL('../',import.meta.url);
const edge=readFileSync(new URL('supabase/functions/advisor-ai-organize-tasks/index.ts',root),'utf8');
const pending=new URL('supabase/changes/automatic_verified_user_ai.sql',root);
const sql=readFileSync(existsSync(pending)?pending:new URL('supabase/migrations/'+readdirSync(new URL('supabase/migrations/',root)).find(n=>n.endsWith('_automatic_verified_user_ai.sql')),root),'utf8');
function harness({confirmed=true,reservation='ok',rpcError=null,authenticated=true}={}){
 let handler,paid=0;const calls=[];
 const db={auth:{getUser:async()=>({data:{user:authenticated?{id:'synthetic-owner',email:'synthetic@example.invalid',email_confirmed_at:confirmed?'2026-10-28':null}:null}})}};
 const admin={rpc:async(name,args)=>{calls.push(name);return name==='advisor_ai_is_allowed_email'?{data:true,error:null}:{data:reservation,error:rpcError}}};
 const context={createClient:(_,key)=>key==='anon'?db:admin,Deno:{env:{get:k=>({SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',OPENAI_API_KEY:'test-placeholder'})[k]},serve:fn=>handler=fn},Response,console:{error(){}},fetch:async()=>{paid++;return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({tasks:[{title:'Synthetic task',area:'work',priority:'normal',due_date:'',description:''}]})}]}]})}};
 runInNewContext(edge.replace(/^import .*\n/,''),context);
 return{request:()=>handler(new Request('https://synthetic.invalid',{method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({text:'Synthetic task'})})),calls,paid:()=>paid};
}
test('confirmed account reserves one request before invoking task AI',async()=>{const h=harness();const r=await h.request();assert.equal(r.status,200);assert.deepEqual(h.calls,['advisor_ai_is_allowed_email','reserve_advisor_task_ai_request']);assert.equal(h.paid(),1);assert.equal((await r.json()).tasks.length,1)});
test('unauthenticated, unconfirmed, disabled and exhausted accounts cannot invoke paid AI',async()=>{for(const [opts,status]of[[{authenticated:false},401],[{confirmed:false},403],[{reservation:'disabled'},403],[{reservation:'user_limit'},429],[{reservation:'global_limit'},429],[{rpcError:{code:'test'}},503]]){const h=harness(opts);assert.equal((await h.request()).status,status);assert.equal(h.paid(),0)}});
test('registration eligibility uses verified Auth users rather than a manual email list',()=>{assert.match(sql,/from auth.users u/);assert.match(sql,/email_confirmed_at is not null/);assert.doesNotMatch(sql,/from public.advisor_ai_allowed_emails/);assert.match(sql,/not a.enabled/)});
test('task quotas are atomic, fixed and service-only; no browser privileges are widened',()=>{assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/v_user_count>=12/);assert.match(sql,/v_global_count>=150/);assert.match(sql,/revoke all[^;]*from public,anon,authenticated/);assert.doesNotMatch(sql,/grant.*(?:select|insert|update).*to (?:anon|authenticated)/i);assert.doesNotMatch(edge,/count:'exact'/)});
