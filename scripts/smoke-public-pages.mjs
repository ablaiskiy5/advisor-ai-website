const base='https://ablaiskiy5.github.io/advisor-ai-website/';
const pages=['index.html','workspace.html','ai-chat.html','portfolio-report.html','bond-analysis.html','ideas-risk-budget.html','tasks-board.html','tools-health.html','privacy.html','terms.html','support.html'];
let failures=0;
for(const page of pages){
 try{
  const res=await fetch(base+page,{signal:AbortSignal.timeout(15000)});
  const html=await res.text();
  const ok=res.ok&&/<html[\s>]/i.test(html)&&html.length>200;
  console.log((ok?'PASS':'FAIL')+' '+page+' HTTP '+res.status);
  if(!ok)failures++;
 }catch(err){failures++;console.error('FAIL '+page+' '+err.message)}
}
if(failures)process.exitCode=1;
else console.log('All public pages reachable; authenticated workflows not tested.');
