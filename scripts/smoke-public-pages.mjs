// Public deployment smoke test: no credentials or customer data.
const base='https://ablaiskiy5.github.io/advisor-ai-website/';
const pages=[
 ['index.html','Advisor AI'],
 ['workspace.html','Создать аккаунт'],
 ['ai-chat.html','Advisor AI'],
 ['portfolio-report.html','портфел'],
 ['bond-analysis.html','облигац'],
 ['ideas-risk-budget.html','риск'],
 ['tasks-board.html','задач'],
 ['tools-health.html','Advisor AI'],
 ['privacy.html',''],
 ['terms.html',''],
 ['support.html','']
];
let failed=0;
for(const [path,marker] of pages){
 try{
  const response=await fetch(base+path,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
  const html=await response.text();
  const ok=response.ok&&html.includes('<html')&&(!marker||html.toLowerCase().includes(marker.toLowerCase()));
  console.log((ok?'PASS':'FAIL')+' '+path+' HTTP '+response.status+' bytes '+html.length);
  if(!ok)failed++;
 }catch(err){failed++;console.error('FAIL '+path+' '+err.message)}
}
if(failed){console.error(failed+' live public page(s) failed');process.exitCode=1}
else console.log('All '+pages.length+' public pages are reachable. Authenticated workflows remain untested.');
