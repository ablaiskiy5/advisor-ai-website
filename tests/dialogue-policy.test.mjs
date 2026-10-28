import test from 'node:test';
import assert from 'node:assert/strict';
import {configureDialogue,askWithReserve,successfulSearches,DIALOGUE_MODEL} from '../supabase/functions/advisor-ai-chat/dialogue-policy.mjs';
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
