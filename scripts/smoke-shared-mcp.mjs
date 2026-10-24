#!/usr/bin/env node
// Deterministic public MCP smoke test. No login, secrets or client data required.
const endpoint=process.env.ADVISOR_AI_MCP_URL||'https://xhewhzgzzonpgsjznmyl.supabase.co/functions/v1/advisor-ai-shared-tools';
if(!/^https:\/\//.test(endpoint))throw Error('HTTPS endpoint required');
let seq=0;
async function call(method,params={}){
 const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++seq,method,params}),signal:AbortSignal.timeout(15000)});
 const data=await response.json();
 if(!response.ok||data.error)throw Error(method+' returned '+response.status+': '+JSON.stringify(data.error||data).slice(0,300));
 return data.result;
}
function assert(cond,message){if(!cond)throw Error('FAIL: '+message)}
function equalNumber(actual,expected,label,epsilon=1e-8){assert(Math.abs(actual-expected)<=epsilon,label+': expected '+expected+', got '+actual)}
async function run(){
 const info=await call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'advisor-ai-smoke',version:'1.0'}});
 assert(info.serverInfo?.name==='advisor-ai-shared-tools','Server identity');
 const discovery=await call('server/discover');
 assert(discovery.resultType==='complete'&&discovery.cacheScope==='public','Public MCP discovery contract');
 const listed=await call('tools/list');
 const expected=['bond_current_yield','portfolio_concentration','trade_risk_budget','bond_duration_shock'];
 for(const name of expected)assert(listed.tools?.some(x=>x.name===name),'Missing '+name);
 assert(listed.tools.length===expected.length,'Unexpected tool exposed on public MCP');
 assert(listed.tools.every(x=>x.inputSchema?.type==='object'),'Every public tool must declare an object input schema');
 const invoke=async(name,args)=>{
  const result=await call('tools/call',{name,arguments:args});
  assert(result.isError!==true,name+' reported an error');
  const v=result.structuredContent;
  assert(v&&typeof v==='object',name+' omitted structuredContent');
  return v;
 };
 const reject=async(name,args,label)=>{
  const result=await call('tools/call',{name,arguments:args});
  assert(result.isError===true,label+' must be rejected');
  assert(!result.structuredContent,label+' must not return structured client data');
 };
 const bond=await invoke('bond_current_yield',{face:1000,coupon_percent:6,price:950});
 equalNumber(bond.current_yield_percent,6.315789473684211,'Bond current yield');
 const concentration=await invoke('portfolio_concentration',{holdings:[{ticker:'A',value:70},{ticker:'B',value:30}]});
 equalNumber(concentration.hhi,0.58,'Concentration HHI');
 const within=await invoke('trade_risk_budget',{portfolio_usd:1000000,pool_percent:10,positions:[{name:'NVDA',amount_usd:25000},{name:'AMZN',amount_usd:25000},{name:'QQQ',amount_usd:30000},{name:'XBI',amount_usd:20000}]});
 assert(within.within_pool&&within.remaining_usd===0,'Correct pool allocation');
 const over=await invoke('trade_risk_budget',{portfolio_usd:1000000,pool_percent:10,positions:[{name:'NVDA',amount_usd:100000},{name:'AMZN',amount_usd:100000},{name:'QQQ',amount_usd:100000},{name:'XBI',amount_usd:100000}]});
 assert(!over.within_pool&&over.remaining_usd===-300000,'Excessive pool allocation must fail');
 const shock=await invoke('bond_duration_shock',{portfolio_usd:1000000,bond_usd:300000,modified_duration:5,yield_change_bp:100});
 equalNumber(shock.portfolio_change_percent,-1.5,'Duration stress');
 await reject('bond_current_yield',{face:1000,coupon_percent:6,price:0},'Zero bond price');
 await reject('portfolio_concentration',{holdings:[{ticker:'A',value:100},{ticker:'a',value:1}]},'Duplicate tickers (case-insensitive)');
 await reject('trade_risk_budget',{portfolio_usd:1000000,pool_percent:10,positions:[{name:'Invalid',amount_usd:-1}]},'Negative allocation');
 await reject('bond_duration_shock',{portfolio_usd:1000000,bond_usd:1000001,modified_duration:5,yield_change_bp:100},'Bond notional greater than portfolio');
 await reject('private_case_list',{},'Undeclared private tool');
 console.log('OK: public MCP discovery, 4 allowlisted tools, arithmetic and 5 rejection checks');
}
run().catch(error=>{console.error(error.message);process.exitCode=1});
