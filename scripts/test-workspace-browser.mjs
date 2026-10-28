// Real Chromium interactions against local production HTML, with synthetic Supabase responses.
// This deliberately does NOT assert live authentication, RLS, AI or paid API availability.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(root+'/'))throw Error();const data=await readFile(path);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'text/plain');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.ADVISOR_CHROMIUM_PATH||undefined,args:process.env.ADVISOR_CHROMIUM_PATH?['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu']:[]});
try{
 const context=await browser.newContext();
 await context.route('https://**/*',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().includes('supabase-js')?`
 const syntheticUser={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.invalid'};
 const syntheticCase={id:'22222222-2222-4222-8222-222222222222',kind:'portfolio',user_id:syntheticUser.id,title:'Synthetic portfolio',notes:'',prompt:'Synthetic analysis',status:'Новая',updated_at:'2026-10-27T00:00:00.000Z',chat_url:''};
 const syntheticCases=[syntheticCase],syntheticMessages=[];let syntheticClock=0;window.syntheticInvokes=[];
 const stamp=()=>new Date(Date.now()+syntheticClock++*10).toISOString();
 const syntheticDb={auth:{getSession:async()=>({data:{session:localStorage.getItem('synthetic-signed-out')?null:{user:syntheticUser}}}),getUser:async()=>({data:{user:localStorage.getItem('synthetic-signed-out')?null:syntheticUser}}),signUp:async()=>({data:{session:null},error:null}),signInWithPassword:async()=>({data:{session:null},error:{code:'invalid_credentials'}}),onAuthStateChange(fn){window.syntheticAuth=fn},signOut:async()=>{window.syntheticAuth('SIGNED_OUT',null);return {}}},functions:{invoke:async(name,options)=>{
  if(options?.method==='GET')return{error:{message:'Synthetic metadata unavailable'}};
  const caseId=options.body.case_id,record=syntheticCases.find(x=>x.id===caseId),last=syntheticMessages.filter(x=>x.case_id===caseId).at(-1);window.syntheticInvokes.push({caseId,content:last?.content});
  const content=record?.prompt.includes('экзаменатор')?(last?.content.startsWith('Мой ответ')?'Оценка: 4/5. Следующий вопрос: как меняется цена облигации при росте ставки?':'Что означает модифицированная дюрация?'):['## Краткий вывод','Synthetic result with **facts**.','- One practical action','<img src=x onerror=alert(1)>'].join('\\n');
  syntheticMessages.push({id:crypto.randomUUID(),case_id:caseId,user_id:syntheticUser.id,role:'assistant',content,created_at:stamp()});return{data:{ok:true,tools:{web_search_called:1}},error:null};
 }},from(table){let single=false,insert=null;const filters=[];const query={select(){return this},insert(row){insert=row;return this},eq(k,v){filters.push(row=>row[k]===v);return this},gte(k,v){filters.push(row=>row[k]>=v);return this},order(){return this},limit(){return this},range(){return this},in(k,values){filters.push(row=>values.includes(row[k]));return this},single(){single=true;return this},maybeSingle(){single=true;return this},then(resolve){
  let rows=table==='workspace_items'?syntheticCases:table==='advisor_ai_messages'?syntheticMessages:[];
  if(insert){const row={id:crypto.randomUUID(),created_at:stamp(),...insert};rows.push(row);resolve({data:row,error:null});return}
  rows=rows.filter(row=>filters.every(fn=>fn(row))).slice().reverse();resolve({data:single?rows[0]||null:rows,error:null});
 }};return query}};
 window.supabase={createClient:()=>syntheticDb};
 `:''}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  for(const file of ['workspace.html','ai-chat.html?case=22222222-2222-4222-8222-222222222222','tasks-board.html','portfolio-report.html','bond-analysis.html','ideas-risk-budget.html','tools-health.html']){
   await page.goto(base+'/'+file);await page.locator('body.has-workspace-shell').waitFor();
   assert.equal(await page.locator('#shell-sidebar nav a').count(),10,file);
   if(width<=900){await page.locator('#shell-menu').click();assert.equal(await page.locator('#shell-menu').getAttribute('aria-expanded'),'true');assert.equal(await page.locator('main').evaluate(n=>n.inert),true);await page.locator('#shell-menu').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#shell-sidebar .shell-site').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.locator('#shell-menu').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#shell-menu').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('main').evaluate(n=>n.inert),false)}
   else{assert.equal(await page.locator('#shell-sidebar').isVisible(),true);await page.locator('#shell-collapse').click();assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('shell-collapsed')),true);await page.locator('#shell-collapse').click()}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow: '+file+' at '+width);
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto(base+'/workspace.html#history');await page.getByRole('heading',{name:'История и сохранённое',exact:true}).waitFor();
 await page.locator('#shell-sidebar [data-section="documents"]').click();await page.getByRole('heading',{name:'Документы',exact:true}).waitFor();
 assert.equal(await page.locator('#shell-sidebar [aria-current="page"]').getAttribute('data-section'),'documents');
 await page.locator('#shell-sidebar [data-section="portfolio"]').click();await page.getByRole('heading',{name:'Что сделаем с портфелем?',exact:true}).waitFor();
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('#workspace-shell').isVisible(),false);await page.emulateMedia({media:'screen'});
 // Exercise actual DOM navigation and draft recovery, without real accounts or network writes.
 const casePath='/ai-chat.html?case=22222222-2222-4222-8222-222222222222';
 await page.goto(base+casePath);await page.locator('#question:not([disabled])').waitFor();
 await page.locator('#question').fill('Synthetic covered call question');
 assert.match(await page.locator('#input-guidance').textContent(),/актуальная опционная цепочка/);
 await page.locator('#shell-sidebar [data-section="ideas"]').click();
 await page.goto(base+casePath);await page.locator('#question:not([disabled])').waitFor();
 assert.equal(await page.locator('#question').inputValue(),'Synthetic covered call question');
 await page.goto(base+'/tasks-board.html');await page.locator('#brain-mic:not([disabled])').waitFor();
 await page.locator('#brain').fill('Synthetic task A; task B tomorrow');
 await page.locator('#shell-sidebar [data-section="portfolio"]').click();
 await page.locator('#shell-sidebar [data-section="tasks"]').click();await page.locator('#brain-mic:not([disabled])').waitFor();
 assert.equal(await page.locator('#brain').inputValue(),'Synthetic task A; task B tomorrow');
 await page.goto(base+'/workspace.html?case=22222222-2222-4222-8222-222222222222');await page.locator('#holdings-input').waitFor();
 await page.locator('#holdings-input').fill('SYNTH; 10; 20');
 await page.locator('#shell-sidebar [data-section="history"]').click();await page.locator('[data-action="open"]').click();
 assert.equal(await page.locator('#holdings-input').inputValue(),'SYNTH; 10; 20');
 // Primary section buttons stay in Workspace and do not call AI before submission.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  for(const [kind,flow]of[['ideas','company'],['ideas','sector'],['markets','review'],['markets','scenario'],['academy','learn'],['academy','exam']]){
   if(width<=900)await page.locator('#shell-menu').click();
   await page.locator('#shell-sidebar [data-section="'+kind+'"]').click();
   const before=await page.evaluate(()=>window.syntheticInvokes.length);
   await page.locator('[data-action="startflow"][data-flow="'+flow+'"]').click();
   assert.ok(page.url().includes('workspace.html'),'Scenario must not navigate to chat');assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),before);
   await page.locator('#wb-subject').fill(kind==='academy'?'Модифицированная дюрация':'Synthetic '+kind+' '+flow);
   await page.locator('#wb-form button[type="submit"]').click();
   await page.locator('#wb-result').waitFor();await page.locator('#wb-status').filter({hasText:'Результат сохранён'}).waitFor();
   assert.equal(await page.locator('#wb-result img,#wb-result script').count(),0);
   assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),before+1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Workbench overflow '+kind+' '+width);
   if(flow==='exam'){
    await page.locator('#wb-reply').fill('Это чувствительность цены к изменению доходности.');await page.locator('#wb-reply-form button').click();
    await page.locator('#wb-result').filter({hasText:'Оценка: 4/5'}).waitFor();await page.locator('#wb-status').filter({hasText:'Результат сохранён'}).waitFor();
   }
  }
 }
 const requestsBeforeHistory=await page.evaluate(()=>window.syntheticInvokes.length);
 if((await page.locator('#shell-menu').isVisible()))await page.locator('#shell-menu').click();
 await page.locator('#shell-sidebar [data-section="history"]').click();await page.evaluate(()=>AdvisorWorkbench.reset());
 await page.locator('[data-action="openresult"]').first().click();await page.locator('#wb-result').waitFor();await page.locator('#wb-status').filter({hasText:'без AI-запроса'}).waitFor();
 assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),requestsBeforeHistory);
 if(process.env.ADVISOR_QA_DIR){await mkdir(process.env.ADVISOR_QA_DIR,{recursive:true});await page.screenshot({path:process.env.ADVISOR_QA_DIR+'/workbench-exam-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{window.scrollTo(0,0);document.activeElement?.blur()});await page.locator('#shell-sidebar [data-section="ideas"]').click();await page.evaluate(()=>{window.scrollTo(0,0);document.activeElement?.blur()});await page.screenshot({path:process.env.ADVISOR_QA_DIR+'/workbench-ideas-desktop.png',fullPage:true})}
 await page.evaluate(()=>window.syntheticAuth('SIGNED_OUT',null));
 assert.equal(await page.evaluate(()=>AdvisorWorkbench.markup('ideas')),'');
 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('advisor-input-draft-v1:')).length),0);
 await page.evaluate(()=>localStorage.setItem('synthetic-signed-out','1'));await page.reload();
 await page.locator('#login-email').fill('synthetic@example.invalid');await page.locator('#login-pass').fill('synthetic-password');
 await page.locator('[data-action="signup"]').click();await page.getByRole('status').filter({hasText:'папку «Спам»'}).waitFor();
 await page.locator('[data-action="login"]').click();await page.getByRole('status').filter({hasText:'Неверный email или пароль'}).waitFor();
 if(process.env.ADVISOR_QA_DIR){
  await mkdir(process.env.ADVISOR_QA_DIR,{recursive:true});
  await page.screenshot({path:process.env.ADVISOR_QA_DIR+'/signup-desktop.png',fullPage:true});
  await page.evaluate(()=>localStorage.removeItem('synthetic-signed-out'));await page.goto(base+'/workspace.html');
  await page.screenshot({path:process.env.ADVISOR_QA_DIR+'/home-desktop.png',fullPage:true});
  await page.goto(base+casePath);await page.locator('#question:not([disabled])').waitFor();await page.screenshot({path:process.env.ADVISOR_QA_DIR+'/chat-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/tasks-board.html');await page.locator('#shell-menu').click();await page.screenshot({path:process.env.ADVISOR_QA_DIR+'/tasks-mobile-menu.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS: seven pages, desktop/mobile menus, collapse, keyboard, deep links, history/documents, print, six inline workbenches and exam replies, chat/task/portfolio draft recovery, logout purge, signup/error UI. Synthetic auth only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
