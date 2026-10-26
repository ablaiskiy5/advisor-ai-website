#!/usr/bin/env node
import { requireMcpResult, requireMcpInitialize } from './mcp-response.mjs';
// Deterministic public MCP smoke test. No login, secrets or client data required.
const endpoint=process.env.ADVISOR_AI_MCP_URL||'https://xhewhzgzzonpgsjznmyl.supabase.co/functions/v1/advisor-ai-shared-tools';
if(!/^https:\/\//.test(endpoint))throw Error('HTTPS endpoint required');
let seq=0;
async function call(method,params={}){
 const requestId=++seq;
 const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal:AbortSignal.timeout(15000)});
 const data=await response.json();
 if(!response.ok||data?.error)throw Error(method+' returned '+response.status+': '+JSON.stringify(data?.error||data).slice(0,300));
 return requireMcpResult(data,requestId,method);
}
function assert(cond,message){if(!cond)throw Error('FAIL: '+message)}
function equalNumber(actual,expected,label,epsilon=1e-8){assert(Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<=epsilon,label+': expected '+expected+', got '+actual)}
function equalBoolean(actual,expected,label){assert(typeof actual==='boolean'&&actual===expected,label+': expected '+expected+', got '+String(actual))}
async function run(){
 const info=await call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'advisor-ai-smoke',version:'1.0'}});
 requireMcpInitialize(info);
 const discovery=await call('server/discover');
 assert(discovery.resultType==='complete'&&discovery.cacheScope==='public','Public MCP discovery contract');
 const listed=await call('tools/list');
 assert(Array.isArray(listed.tools),'MCP tool list must be an array');
 assert(listed.tools.every(x=>x.name&&x.description&&x.inputSchema?.type==='object'),'Public tool metadata must be usable');
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
 const par=await invoke('bond_current_yield',{face:1000,coupon_percent:6,price:1000});
 equalNumber(par.current_yield_percent,6,'At-par bond current yield equals coupon rate');
 const concentration=await invoke('portfolio_concentration',{holdings:[{ticker:'A',value:70},{ticker:'B',value:30}]});
 equalNumber(concentration.hhi,0.58,'Concentration HHI');
 equalNumber(concentration.total_usd,100,'Concentration total value');
 equalNumber(concentration.top1_percent,70,'Largest holding percentage');
 equalNumber(concentration.top3_percent,100,'Top-three concentration with two holdings');
 equalNumber(concentration.top5_percent,100,'Top-five concentration with two holdings');
 assert(Array.isArray(concentration.positions)&&concentration.positions.length===2,'Concentration position count');
 equalNumber(concentration.positions.reduce((sum,p)=>sum+p.weight_percent,0),100,'Holding weights sum to 100%');
 const scaled=await invoke('portfolio_concentration',{holdings:[{ticker:'A',value:700},{ticker:'B',value:300}]});
 equalNumber(scaled.hhi,concentration.hhi,'HHI is invariant to portfolio size');
 equalNumber(scaled.top1_percent,concentration.top1_percent,'Largest holding weight is invariant to portfolio size');
 equalNumber(concentration.effective_positions,1/concentration.hhi,'Effective positions is inverse HHI');
 const within=await invoke('trade_risk_budget',{portfolio_usd:1000000,pool_percent:10,positions:[{name:'NVDA',amount_usd:25000},{name:'AMZN',amount_usd:25000},{name:'QQQ',amount_usd:30000},{name:'XBI',amount_usd:20000}]});
 equalBoolean(within.within_pool,true,'Within-pool flag');
 equalNumber(within.remaining_usd,0,'Correct pool allocation');
 equalNumber(within.budget_usd,100000,'Ten-percent speculative pool');
 equalNumber(within.allocated_usd,100000,'Allocated position total');
 assert(Array.isArray(within.positions)&&within.positions.length===4,'Risk-budget position count');
 equalNumber(within.positions.reduce((sum,p)=>sum+p.amount_usd,0),within.allocated_usd,'Position amounts reconcile to allocation');
 equalNumber(within.positions.reduce((sum,p)=>sum+p.percent_of_portfolio,0),10,'Position percentages reconcile to portfolio');
 const over=await invoke('trade_risk_budget',{portfolio_usd:1000000,pool_percent:10,positions:[{name:'NVDA',amount_usd:100000},{name:'AMZN',amount_usd:100000},{name:'QQQ',amount_usd:100000},{name:'XBI',amount_usd:100000}]});
 equalBoolean(over.within_pool,false,'Exceeded-pool flag');
 equalNumber(over.remaining_usd,-300000,'Excessive pool allocation must fail');
 const shock=await invoke('bond_duration_shock',{portfolio_usd:1000000,bond_usd:300000,modified_duration:5,yield_change_bp:100});
 equalNumber(shock.portfolio_change_percent,-1.5,'Duration stress');
 equalNumber(shock.change_usd,-15000,'Duration stress dollar impact');
 const fallingYields=await invoke('bond_duration_shock',{portfolio_usd:1000000,bond_usd:300000,modified_duration:5,yield_change_bp:-100});
 equalNumber(fallingYields.portfolio_change_percent,1.5,'Duration stress reverses sign when yields fall');
 equalNumber(shock.change_usd+fallingYields.change_usd,0,'Linear duration shocks are symmetric');
 const noShock=await invoke('bond_duration_shock',{portfolio_usd:1000000,bond_usd:300000,modified_duration:5,yield_change_bp:0});
 equalNumber(noShock.change_usd,0,'Zero yield shock has zero impact');
 await reject('bond_current_yield',{face:1000,coupon_percent:6,price:0},'Zero bond price');
 await reject('bond_current_yield',{face:1000,coupon_percent:101,price:950},'Coupon rate above 100%');
 await reject('portfolio_concentration',{holdings:[{ticker:'A',value:100},{ticker:'a',value:1}]},'Duplicate tickers (case-insensitive)');
 await reject('trade_risk_budget',{portfolio_usd:1000000,pool_percent:10,positions:[{name:'Invalid',amount_usd:-1}]},'Negative allocation');
 await reject('bond_duration_shock',{portfolio_usd:1000000,bond_usd:1000001,modified_duration:5,yield_change_bp:100},'Bond notional greater than portfolio');
 await reject('private_case_list',{},'Undeclared private tool');
 await reject('bond_current_yield',{face:1000,coupon_percent:'6',price:950},'String instead of numeric coupon');
 // Each calculator must reject coercible numeric strings, including nested position values.
 await reject('bond_current_yield',{face:'1000',coupon_percent:6,price:950},'String instead of numeric face');
 await reject('bond_current_yield',{face:1000,coupon_percent:6,price:'950'},'String instead of numeric price');
 await reject('portfolio_concentration',{holdings:[{ticker:'A',value:'100'}]},'String instead of numeric holding value');
 await reject('trade_risk_budget',{portfolio_usd:'1000000',pool_percent:10,positions:[]},'String instead of numeric portfolio value');
 await reject('trade_risk_budget',{portfolio_usd:1000000,pool_percent:10,positions:[{name:'A',amount_usd:'100'}]},'String instead of numeric allocation');
 await reject('bond_duration_shock',{portfolio_usd:1000000,bond_usd:300000,modified_duration:'5',yield_change_bp:100},'String instead of numeric duration');
 await reject('bond_duration_shock',{portfolio_usd:1000000,bond_usd:300000,modified_duration:5,yield_change_bp:'100'},'String instead of numeric yield shock');
 await reject('portfolio_concentration',{holdings:[]},'Empty holdings');
 await reject('bond_duration_shock',{portfolio_usd:1000000,bond_usd:-1,modified_duration:5,yield_change_bp:100},'Negative bond notional');
 await reject('bond_duration_shock',{portfolio_usd:1000000,bond_usd:300000,modified_duration:5,yield_change_bp:10001},'Yield shock beyond limit');
 console.log('OK: public MCP discovery, 4 allowlisted tools, arithmetic invariants and 17 rejection checks');
}
run().catch(error=>{console.error(error.message);process.exitCode=1});
