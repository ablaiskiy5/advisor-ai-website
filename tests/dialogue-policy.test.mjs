import test from 'node:test';
import assert from 'node:assert/strict';
import {configureDialogue,askWithReserve,successfulSearches,probeDialogueModel,DIALOGUE_MODEL,providerFailure} from '../supabase/functions/advisor-ai-chat/dialogue-policy.mjs';
test('dialogue upgrade keeps bounded Responses settings and live high-context search',()=>{
 const body={instructions:'Original',input:['history'],store:false};
 assert.equal(configureDialogue(body,{kind:'ideas'}),true);
 assert.equal(body.model,DIALOGUE_MODEL); assert.equal(body.reasoning.effort,'low');
 assert.equal(body.max_output_tokens,8000); assert.equal(body.max_tool_calls,6);
 assert.equal(body.tools[0].search_context_size,'high'); assert.equal(body.tools[0].external_web_access,true);
 assert.deepEqual(body.input,['history']); assert.equal(body.store,false);
 assert.match(body.instructions,/персональные данные/); assert.match(body.instructions,/первоисточники/);
});
test('basic lessons can optionally search, latest news must search and explicit server model wins',()=>{
 const body={instructions:''}; assert.equal(configureDialogue(body,{kind:'academy',question:'Что такое дюрация?',model:' custom-model '}),false);
 assert.equal(body.model,'custom-model'); assert.equal(body.tools.length,1);
 assert.equal(configureDialogue({instructions:''},{question:'Какие последние новости?'}),true);
});
test('unavailable flagship retries once on reserve and records actual selected model',async()=>{
 const body={model:DIALOGUE_MODEL}; const calls=[];
 const result=await askWithReserve(body,async b=>{calls.push(b.model);return calls.length===1?{response:{ok:false,status:404},payload:{error:{code:'model_not_found'}}}:{response:{ok:true,status:200},payload:{}}});
 assert.deepEqual(calls,[DIALOGUE_MODEL,'gpt-5-mini']); assert.equal(result.reserved,true); assert.equal(body.model,'gpt-5-mini');
});
test('billing, rate, transport, tool failures and successful calls never trigger model retry',async()=>{
 for(const status of [200,400,401,403,429,500,503]){let calls=0;const result=await askWithReserve({model:DIALOGUE_MODEL},async()=>{calls++;return {response:{ok:status===200,status},payload:{error:{code:'insufficient_quota'}}}});assert.equal(calls,1);assert.equal(result.reserved,false)}
 await assert.rejects(askWithReserve({model:DIALOGUE_MODEL},async()=>{throw new Error('network')}),/network/);
});
test('only completed searches count as verified tool execution',()=>{
 assert.equal(successfulSearches([{type:'web_search_call',status:'failed'},{type:'web_search_call',status:'in_progress'},{type:'web_search_call',status:'completed'},{type:'mcp_call',status:'completed'}]),1);
});

test('provider model probe is read-only, cached and never returns secrets',async()=>{
 let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.match(url,/\/models\/gpt-6-astra$/);assert.equal(options.method,undefined);return {ok:true}};
 assert.equal(await probeDialogueModel(DIALOGUE_MODEL,'synthetic-key',fetcher,1000),true);
 assert.equal(await probeDialogueModel(DIALOGUE_MODEL,'synthetic-key',fetcher,1001),true);
 assert.equal(calls,1);
 assert.equal(await probeDialogueModel('missing','synthetic',async()=>({ok:false,status:404}),2000),false);
 assert.equal(await probeDialogueModel('unknown','synthetic',async()=>({ok:false,status:403}),3000),null);
});

test('billing 429 differs from retryable rate limits without exposing provider details',()=>{
 for(const code of ['credit_balance_exhausted','insufficient_quota','organization_usage_limit_exceeded']){
  const result=providerFailure(429,{error:{code,message:'private provider details'}});
  assert.equal(result.status,503);assert.equal(result.retryable,false);assert.equal(result.code,'ai_billing_unavailable');assert.doesNotMatch(result.error,/private provider details/);
 }
 const rate=providerFailure(429,{error:{code:'rate_limit_exceeded'}});assert.equal(rate.status,429);assert.equal(rate.retryable,true);
 assert.equal(providerFailure(500,{}),null);
});
