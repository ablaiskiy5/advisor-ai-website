const tools=[
 {name:'bond_current_yield',description:'Calculate annual coupon cash flow and current yield for a fixed-rate bond. NOT yield to maturity.',inputSchema:{type:'object',additionalProperties:false,required:['face','coupon_percent','price'],properties:{face:{type:'number',exclusiveMinimum:0},coupon_percent:{type:'number',minimum:0,maximum:100},price:{type:'number',exclusiveMinimum:0}}}},
 {name:'portfolio_concentration',description:'Compute portfolio weights, top positions, HHI and effective count from positive USD position values.',inputSchema:{type:'object',additionalProperties:false,required:['holdings'],properties:{holdings:{type:'array',minItems:1,maxItems:100,items:{type:'object',additionalProperties:false,required:['ticker','value'],properties:{ticker:{type:'string'},value:{type:'number',minimum:0}}}}}}},
 {name:'trade_risk_budget',description:'Check if proposed allocations fit a single overall speculative pool, not a budget per idea.',inputSchema:{type:'object',additionalProperties:false,required:['portfolio_usd','pool_percent','positions'],properties:{portfolio_usd:{type:'number',exclusiveMinimum:0},pool_percent:{type:'number',minimum:0,maximum:100},positions:{type:'array',maxItems:50,items:{type:'object',required:['name','amount_usd'],properties:{name:{type:'string'},amount_usd:{type:'number',minimum:0}}}}}}},
 {name:'bond_duration_shock',description:'Linear first-order portfolio impact of a bond yield shock.',inputSchema:{type:'object',additionalProperties:false,required:['portfolio_usd','bond_usd','modified_duration','yield_change_bp'],properties:{portfolio_usd:{type:'number',exclusiveMinimum:0},bond_usd:{type:'number',minimum:0},modified_duration:{type:'number',minimum:0,maximum:100},yield_change_bp:{type:'number',minimum:-10000,maximum:10000}}}}
];
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
function calculate(name,a){
 if(!a||typeof a!=='object'||Array.isArray(a))throw Error('Arguments must be an object');
 if(name==='bond_current_yield'){
  const {face,coupon_percent,price}=a;if(!finite(face)||face<=0||!finite(coupon_percent)||coupon_percent<0||coupon_percent>100||!finite(price)||price<=0)throw Error('Invalid face, coupon or price');
  const annual_coupon=face*coupon_percent/100;return {annual_coupon_usd:annual_coupon,current_yield_percent:100*annual_coupon/price,formula:'annual_coupon / price',note:'Current yield is not YTM; ignores maturity, price pull-to-par and default'};
 }
 if(name==='portfolio_concentration'){
  if(!Array.isArray(a.holdings)||a.holdings.length===0||a.holdings.length>100)throw Error('Holdings: 1–100 entries');
  let seen=new Set();const h=a.holdings.map(x=>{if(!x||typeof x.ticker!=='string'||!x.ticker.trim()||!finite(x.value)||x.value<0||x.value>1e13)throw Error('Invalid holding');const ticker=x.ticker.trim().toUpperCase();if(seen.has(ticker))throw Error('Duplicate ticker');seen.add(ticker);return {ticker,value:x.value}});
  const total=h.reduce((n,x)=>n+x.value,0);if(total<=0||total>1e15)throw Error('Portfolio total invalid');const rows=h.map(x=>({...x,weight_percent:x.value/total*100})).sort((a,b)=>b.value-a.value);const hhi=rows.reduce((n,x)=>n+(x.value/total)**2,0);return {total_usd:total,positions:rows,top1_percent:rows[0].weight_percent,top3_percent:rows.slice(0,3).reduce((n,x)=>n+x.weight_percent,0),top5_percent:rows.slice(0,5).reduce((n,x)=>n+x.weight_percent,0),hhi,effective_positions:1/hhi};
 }
 if(name==='trade_risk_budget'){
  const {portfolio_usd,pool_percent,positions}=a;if(!finite(portfolio_usd)||portfolio_usd<=0||portfolio_usd>1e15||!finite(pool_percent)||pool_percent<0||pool_percent>100||!Array.isArray(positions)||positions.length>50)throw Error('Invalid budget');
  const budget=portfolio_usd*pool_percent/100;let total=0;const details=positions.map(p=>{if(!p||typeof p.name!=='string'||!finite(p.amount_usd)||p.amount_usd<0||p.amount_usd>1e13)throw Error('Invalid position');total+=p.amount_usd;return {name:p.name.slice(0,90),amount_usd:p.amount_usd,percent_of_portfolio:100*p.amount_usd/portfolio_usd}});
  return {portfolio_usd,pool_percent,budget_usd:budget,allocated_usd:total,remaining_usd:budget-total,within_pool:total<=budget||(budget>0&&total-budget<=8*Number.EPSILON*Math.max(total,budget)),positions:details};
 }
 if(name==='bond_duration_shock'){
  const {portfolio_usd,bond_usd,modified_duration,yield_change_bp}=a;if(!finite(portfolio_usd)||portfolio_usd<=0||!finite(bond_usd)||bond_usd<0||bond_usd>portfolio_usd||!finite(modified_duration)||modified_duration<0||modified_duration>100||!finite(yield_change_bp)||Math.abs(yield_change_bp)>10000)throw Error('Invalid duration scenario');
  const change_usd=-bond_usd*modified_duration*yield_change_bp/10000;return {change_usd,portfolio_change_percent:100*change_usd/portfolio_usd,assumptions:'Linear duration approximation; excludes convexity, spread movements, FX, transaction costs and default'};
 }
 throw Error('Unknown tool');
}
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,mcp-protocol-version,mcp-method,mcp-name','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const okay=(id,result)=>({jsonrpc:'2.0',id,result}),error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response({error:'POST only'},405);
 const size=Number(req.headers.get('content-length')||0);if(size>20000)return response({error:'Too large'},413);
 let raw;try{raw=await req.text();if(raw.length>20000)throw Error('Too large')}catch{return response({error:'Invalid request'},400)}
 let call;try{call=JSON.parse(raw)}catch{return response(error(null,-32700,'Parse error'),400)}
 if(!call||call.jsonrpc!=='2.0'||typeof call.method!=='string')return response(error(call?.id??null,-32600,'Invalid Request'),400);
 const id=call.id??null;
 if(call.method==='notifications/initialized')return new Response(null,{status:202,headers});
 if(call.method==='initialize')return response(okay(id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'advisor-ai-shared-tools',version:'1.0.0'},instructions:'Public deterministic calculators only. No client records or personal tasks are accessible.'}));
 if(call.method==='server/discover')return response(okay(id,{resultType:'complete',supportedVersions:['2026-07-28','2025-06-18'],capabilities:{tools:{}},ttlMs:3600000,cacheScope:'public',_meta:{'io.modelcontextprotocol/serverInfo':{name:'advisor-ai-shared-tools',version:'1.1.0'}}}));
 if(call.method==='ping')return response(okay(id,{}));
 if(call.method==='tools/list')return response(okay(id,{resultType:'complete',tools,ttlMs:300000,cacheScope:'public'}));
 if(call.method==='tools/call'){
  const name=call.params?.name,args=call.params?.arguments||{};
  try{const out=calculate(name,args);return response(okay(id,{resultType:'complete',content:[{type:'text',text:JSON.stringify(out)}],structuredContent:out,isError:false}))}
  catch(e){return response(okay(id,{content:[{type:'text',text:e.message}],isError:true}))}
 }
 return response(error(id,-32601,'Method not found'),404);
});