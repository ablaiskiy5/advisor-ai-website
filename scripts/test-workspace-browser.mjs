// Real Chromium interactions against local production HTML, with synthetic Supabase responses.
// This deliberately does NOT assert live authentication, RLS, AI or paid API availability.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const docxBundle=await readFile('node_modules/docx/dist/index.umd.cjs','utf8');
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
 const resumed=JSON.parse(sessionStorage.getItem('synthetic-resume-cases')||'null');sessionStorage.removeItem('synthetic-resume-cases');
 const syntheticCases=resumed?.cases||[syntheticCase],syntheticMessages=resumed?.messages||[],syntheticAttachments=[];let syntheticClock=0;window.syntheticInvokes=[];window.syntheticUploads=[];
 window.syntheticSnapshotCases=()=>sessionStorage.setItem('synthetic-resume-cases',JSON.stringify({cases:syntheticCases,messages:syntheticMessages}));
 const stamp=()=>new Date(Date.now()+syntheticClock++*10).toISOString();
 const syntheticDb={auth:{getSession:async()=>({data:{session:localStorage.getItem('synthetic-signed-out')?null:{user:syntheticUser}}}),getUser:async()=>({data:{user:localStorage.getItem('synthetic-signed-out')?null:syntheticUser}}),signUp:async()=>({data:{session:null},error:null}),signInWithPassword:async()=>({data:{session:null},error:{code:'invalid_credentials'}}),onAuthStateChange(fn){window.syntheticAuth=fn},signOut:async()=>{window.syntheticAuth('SIGNED_OUT',null);return {}}},functions:{invoke:async(name,options)=>{
  if(options?.method==='GET')return{error:{message:'Synthetic metadata unavailable'}};
  const caseId=options.body.case_id,record=syntheticCases.find(x=>x.id===caseId),last=syntheticMessages.filter(x=>x.case_id===caseId).at(-1);window.syntheticInvokes.push({caseId,content:last?.content});
  const content=window.syntheticCommunicationAnswer|| (record?.prompt.includes('экзаменатор')?(last?.content.startsWith('Мой ответ')?'Оценка: 4/5. Следующий вопрос: как меняется цена облигации при росте ставки?':'Что означает модифицированная дюрация?'):['## Краткий вывод','Synthetic result with **facts**.','- One practical action','<img src=x onerror=alert(1)>'].join('\\n'));
  syntheticMessages.push({id:crypto.randomUUID(),case_id:caseId,user_id:syntheticUser.id,role:'assistant',content,created_at:stamp()});if(window.syntheticFailAnswerRead){window.syntheticHistoryFailures=1;window.syntheticFailAnswerRead=false}return{data:{ok:true,tools:{web_search_called:1}},error:null};
 }},storage:{from:()=>({upload:async(path,file)=>{window.syntheticUploads.push({path,name:file.name});return {error:null}}})},from(table){let single=false,insert=null;const filters=[];const query={select(){return this},insert(row){insert=row;return this},eq(k,v){filters.push(row=>row[k]===v);return this},gte(k,v){filters.push(row=>row[k]>=v);return this},order(){return this},limit(){return this},range(){return this},in(k,values){filters.push(row=>values.includes(row[k]));return this},single(){single=true;return this},maybeSingle(){single=true;return this},then(resolve){
  let rows=table==='workspace_items'?syntheticCases:table==='advisor_ai_messages'?syntheticMessages:table==='advisor_ai_attachments'?syntheticAttachments:[];
  if(insert){const row={id:crypto.randomUUID(),created_at:stamp(),...insert};rows.push(row);resolve({data:row,error:null});return}
  if(table==='advisor_ai_messages'&&window.syntheticHistoryFailures>0){window.syntheticHistoryFailures--;resolve({data:null,error:{message:'Synthetic history read outage'}});return}
  rows=rows.filter(row=>filters.every(fn=>fn(row))).slice().reverse();resolve({data:single?rows[0]||null:rows,error:null});
 }};return query}};
 window.supabase={createClient:()=>syntheticDb};
 `:route.request().url().includes('docx@9.5.1')?docxBundle:''}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  for(const file of ['workspace.html','ai-chat.html?case=22222222-2222-4222-8222-222222222222','tasks-board.html','portfolio-report.html','bond-analysis.html','ideas-risk-budget.html','tools-health.html']){
   await page.goto(base+'/'+file);await page.locator('body.has-workspace-shell').waitFor();
   assert.equal(await page.locator('#shell-sidebar nav a').count(),11,file);
   if(width<=900){await page.locator('#shell-menu').click();assert.equal(await page.locator('#shell-menu').getAttribute('aria-expanded'),'true');assert.equal(await page.locator('main').evaluate(n=>n.inert),true);await page.locator('#shell-menu').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#shell-sidebar .shell-site').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.locator('#shell-menu').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#shell-menu').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('main').evaluate(n=>n.inert),false)}
   else{assert.equal(await page.locator('#shell-sidebar').isVisible(),true);await page.locator('#shell-collapse').click();assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('shell-collapsed')),true);await page.locator('#shell-collapse').click()}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow: '+file+' at '+width);
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto(base+'/workspace.html#history');await page.getByRole('heading',{name:'История и сохранённое',exact:true}).waitFor();
 await page.locator('#shell-sidebar [data-section="documents"]').click();await page.getByRole('heading',{name:'Документы',exact:true}).waitFor();
 await page.locator('#view .empty').filter({hasText:'Пока нет готовых ответов AI'}).waitFor();assert.equal(await page.locator('#view .item').count(),0,'Documents excludes cases with no AI answer');
 assert.equal(await page.locator('#shell-sidebar [aria-current="page"]').getAttribute('data-section'),'documents');
 await page.locator('#shell-sidebar [data-section="portfolio"]').click();await page.getByRole('heading',{name:'Что сделаем с портфелем?',exact:true}).waitFor();
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('#workspace-shell').isVisible(),false);await page.emulateMedia({media:'screen'});
 // Exercise actual DOM navigation and draft recovery, without real accounts or network writes.
 const casePath='/ai-chat.html?case=22222222-2222-4222-8222-222222222222';
 await page.goto(base+casePath);await page.locator('#question:not([disabled])').waitFor();
 // Long history stays inside a large reading pane while the composer remains visible.
 for(const width of [2560,1920,1440,1024,390,320]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+casePath);await page.locator('#question:not([disabled])').waitFor();
  await page.locator('#question').fill('Synthetic long reading check');await page.locator('#send').click();
  await page.locator('#latest-answer').waitFor();
  await page.locator('#latest-answer .rendered').evaluate(node=>{
   renderAnswerSafe(node,'## Разбор портфеля\n\n'+Array.from({length:32},(_,i)=>'Раздел '+(i+1)+'. Проверяем концентрацию, ликвидность и сценарии. Это синтетический длинный ответ для проверки удобного чтения.').join('\n\n'));
  });
  const layout=await page.locator('#messages').evaluate(node=>({height:node.clientHeight,scroll:node.scrollHeight,overflow:getComputedStyle(node).overflowY}));
  if(process.env.ADVISOR_QA_DIR){await mkdir(process.env.ADVISOR_QA_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.ADVISOR_QA_DIR,'pinned-debug-'+width+'.png')})}
  assert.ok(layout.height>300,'Reading pane must retain useful height '+width+' '+JSON.stringify(layout));
  assert.ok(layout.scroll>layout.height+1000,'Long transcript scrolls inside the pane');
  const space=await page.evaluate(()=>{
   const chat=document.querySelector('.chat').getBoundingClientRect(),main=document.querySelector('main').getBoundingClientRect();
   const nav=innerWidth>900?document.querySelector('#shell-sidebar').getBoundingClientRect().right:0;
   return {left:chat.left-nav,right:innerWidth-main.right,bottom:innerHeight-chat.bottom,width:chat.width};
  });
  assert.ok(space.left>=0&&space.left<=13,'Chat uses space beside navigation '+width+' '+JSON.stringify(space));
  assert.ok(space.right>=-1&&space.right<=1,'Main uses full available width '+width);
  assert.ok(space.bottom>=7&&space.bottom<=9,'Chat reaches viewport bottom with a small gutter '+width+' '+JSON.stringify(space));
  if(width===1024)assert.ok(space.width>740,'Tablet actions move below the chat instead of narrowing it');
  assert.ok(await page.locator('#question').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight),'Composer must remain in view');
  assert.ok(await page.locator('#send').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight),'Send must remain in view');
  assert.equal(layout.overflow,'auto');
  const composerTop=await page.locator('#question').evaluate(n=>n.getBoundingClientRect().top);await page.locator('#messages').evaluate(n=>n.scrollTop=n.scrollHeight);
  assert.equal(await page.locator('#question').evaluate(n=>n.getBoundingClientRect().top),composerTop,'Reading history must not move the composer');
  await page.locator('.composer-tools>summary').click();assert.ok(await page.locator('#question').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight));await page.locator('.composer-tools>summary').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Long chat must fit '+width);
  await page.locator('#jump-latest').click();
  assert.ok(await page.locator('#question').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight));
  if(process.env.ADVISOR_QA_DIR){await mkdir(process.env.ADVISOR_QA_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.ADVISOR_QA_DIR,'chat-reading-'+width+'.png')})}
  const callsBeforeExport=await page.evaluate(()=>window.syntheticInvokes.length);
  await page.evaluate(()=>{window.pdfRequested=null;window.wordRequested=null;window.copiedAnswer=null;window.downloadPdf=async answer=>{window.pdfRequested=answer};window.downloadDocx=async answer=>{window.wordRequested=answer};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedAnswer=text}}});const selected=bubble('assistant','Unique selected earlier answer');selected.id='selected-pdf-test';document.getElementById('messages').prepend(selected)});
  await page.locator('#selected-pdf-test .answer-pdf').click();assert.equal(await page.evaluate(()=>window.pdfRequested),'Unique selected earlier answer');
  await page.locator('#selected-pdf-test .answer-docx').click();assert.equal(await page.evaluate(()=>window.wordRequested),'Unique selected earlier answer');
  await page.locator('#selected-pdf-test .answer-copy').click();assert.equal(await page.evaluate(()=>window.copiedAnswer),'Unique selected earlier answer');
  assert.match(await page.locator('#selected-pdf-test .answer-action-status').textContent(),/скопирован/);
  await page.evaluate(()=>waiting(true));assert.equal(await page.locator('#selected-pdf-test .answer-action:disabled').count(),3);await page.evaluate(()=>waiting(false));
  if(width===390){
   await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
   await page.locator('#selected-pdf-test .answer-copy').click();assert.match(await page.locator('#selected-pdf-test .answer-action-status').textContent(),/Буфер обмена недоступен/);
  }
  assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),callsBeforeExport,'Selected-answer actions must not call paid AI');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Selected-answer action buttons wrap on narrow screens');
  await page.locator('#jump-compose').click();await page.locator('#question').focus();
  assert.equal(await page.locator('#question').evaluate(n=>n===document.activeElement),true);
 }
 // A shorter laptop viewport and sidebar toggle must refit without hiding the input.
 await page.setViewportSize({width:1440,height:768});
 await page.goto(base+casePath);await page.locator('#question:not([disabled])').waitFor();
 await page.locator('#case-title').evaluate(node=>node.textContent='Synthetic case heading with enough words to wrap across multiple lines '.repeat(4));
 const waitForFittedChat=()=>page.waitForFunction(()=>Math.abs(innerHeight-document.querySelector('.chat').getBoundingClientRect().bottom-8)<1);
 await waitForFittedChat();
 await page.locator('#shell-collapse').click();await waitForFittedChat();
 assert.ok(await page.locator('#question').evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight),'Laptop composer remains visible after heading and sidebar changes');
 assert.ok(await page.locator('.chat').evaluate(node=>Math.abs(node.getBoundingClientRect().left-document.querySelector('#shell-sidebar').getBoundingClientRect().right-12)<1),'Collapsed sidebar releases space to chat');
 await page.locator('#shell-collapse').click();await waitForFittedChat();
 // File -> saved AI response -> failed history read -> read-only recovery, without another upload or generation.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto(base+casePath);await page.locator('#question:not([disabled])').waitFor();
  await page.locator('.composer-tools>summary').click();
  await page.locator('#attach-input').setInputFiles({name:'synthetic-portfolio.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC84AAAAASUVORK5CYII=','base64')});
  await page.locator('.composer-tools>summary').click();
  await page.locator('#question').fill('Synthetic attachment recovery check');await page.evaluate(()=>window.syntheticFailAnswerRead=true);await page.locator('#send').click();
  await page.locator('#reload-answer:not(.hidden):not([disabled])').waitFor();
  assert.equal(await page.locator('#retry').isVisible(),false,'Saved response must never suggest paid retry');
  assert.equal(await page.locator('#quick-pdf').isDisabled(),true,'Do not export an older response while the new saved response is unavailable');
  assert.match(await page.locator('#error').textContent(),/без новой генерации/);
  await page.locator('#reload-answer').click();await page.locator('#latest-answer').waitFor();
  assert.equal(await page.locator('#reload-answer').isVisible(),false);
  assert.equal(await page.locator('#retry').isVisible(),false);
  assert.equal(await page.locator('#quick-pdf').isEnabled(),true);
  assert.equal(await page.locator('.bubble.user').count(),1);assert.equal(await page.locator('.bubble.assistant').count(),1);
  assert.match(await page.locator('.bubble.user .filetag').textContent(),/synthetic-portfolio.png/);
  assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),1);assert.equal(await page.evaluate(()=>window.syntheticUploads.length),1);
  await page.locator('#refresh').click();await page.waitForFunction(()=>!working);
  assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),1,'History refresh remains read only');
 }
 await page.setViewportSize({width:1440,height:900});
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
 if((await page.locator('#shell-menu').isVisible()))await page.locator('#shell-menu').click();
 await page.locator('#shell-sidebar [data-section="documents"]').click();
 const beforeDocument=await page.evaluate(()=>window.syntheticInvokes.length);await page.locator('[data-action="startflow"][data-kind="documents"]').click();assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),beforeDocument);
 await page.locator('#wb-subject').fill('Synthetic completed client document');await page.locator('#wb-horizon').fill('Письмо');await page.locator('#wb-form button[type="submit"]').click();await page.locator('#wb-status').filter({hasText:'Результат сохранён'}).waitFor();
 await page.locator('[data-action="refreshdocuments"]').click();const docRow=page.locator('#view .item').filter({hasText:'Synthetic completed client document'});await docRow.waitFor();
 await page.evaluate(()=>AdvisorWorkbench.reset());await docRow.locator('[data-action="openresult"]').click();await page.locator('#wb-status').filter({hasText:'без AI-запроса'}).waitFor();assert.equal(await page.evaluate(()=>workspaceCurrentSection()),'documents');
 assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),beforeDocument+1,'Opening saved document does not regenerate it');
 await page.evaluate(()=>window.syntheticSnapshotCases());await docRow.locator('a[href*="ai-chat.html"]').click();await page.waitForURL(/ai-chat\.html\?case=/);await page.locator('#latest-answer .answer-docx:not([disabled])').waitFor();
 const documentDownload=page.waitForEvent('download');await page.locator('#latest-answer .answer-docx').click();const docx=await documentDownload,docxPath=await docx.path();assert.match(docx.suggestedFilename(),/\.docx$/);
 const xml=execFileSync('unzip',['-p',docxPath,'word/document.xml'],{encoding:'utf8'});assert.match(xml,/Synthetic result/);assert.match(xml,/Synthetic completed client document/);
 await page.evaluate(()=>window.syntheticSnapshotCases());await page.goto(base+'/workspace.html#history');await page.getByRole('heading',{name:'История и сохранённое',exact:true}).waitFor();
 const requestsBeforeHistory=await page.evaluate(()=>window.syntheticInvokes.length);
 if((await page.locator('#shell-menu').isVisible()))await page.locator('#shell-menu').click();
 await page.locator('#shell-sidebar [data-section="history"]').click();await page.evaluate(()=>AdvisorWorkbench.reset());
 await page.locator('[data-action="openresult"]').first().click();await page.locator('#wb-result').waitFor();await page.locator('#wb-status').filter({hasText:'без AI-запроса'}).waitFor();
 assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),requestsBeforeHistory);
 if(await page.locator('#shell-menu').isVisible())await page.locator('#shell-menu').click();
 await page.locator('#shell-sidebar [data-section="communications"]').click();
 const requestsBeforeCommunication=await page.evaluate(()=>window.syntheticInvokes.length);
 await page.locator('#comms-channel').selectOption('WhatsApp');
 await page.locator('#comms-source').fill('Synthetic issuer. Купон 8%.\nБонус сейлзов 777 USD.\nЗаявки до 15:00.');
 await page.locator('#comms-screen').click();
 assert.equal(await page.locator('#comms-approved').inputValue(),'Synthetic issuer. Купон 8%.\nЗаявки до 15:00.');
 assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),requestsBeforeCommunication);
 await page.locator('#comms-approved').fill('Synthetic issuer. Купон 8%.\nЗаявки до 15:00. Алматы.');
 await page.evaluate(()=>window.syntheticCommunicationAnswer='*Купон 8%*\nЗаявки до 15:00. Алматы.');
 await page.getByRole('button',{name:'Подготовить черновик',exact:true}).click();
 await page.locator('#wb-result').waitFor();
 const communicationRequest=await page.evaluate(()=>window.syntheticInvokes.at(-1).content);
 assert.match(communicationRequest,/Аудитория: Клиенты[\s\S]*Канал: WhatsApp[\s\S]*Купон 8%[\s\S]*15:00. Алматы/);
 assert.doesNotMatch(communicationRequest,/777 USD/);
 assert.equal(await page.locator('#wb-result').textContent(),'*Купон 8%*\nЗаявки до 15:00. Алматы.');
 assert.equal(await page.evaluate(()=>Object.values(sessionStorage).some(value=>value.includes('777 USD'))),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const firstCommunicationCase=await page.evaluate(()=>window.syntheticInvokes.at(-1).caseId);
 await page.locator('#wb-reply').fill('Добавь internal only: 999 USD.');
 await page.getByRole('button',{name:'Отправить правку',exact:true}).click();
 await page.locator('#wb-error').filter({hasText:'В правке обнаружены'}).waitFor();
 assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),requestsBeforeCommunication+1);
 await page.locator('#wb-reply').fill('Вынеси срок подачи заявки в начало.');
 await page.evaluate(()=>window.syntheticCommunicationAnswer='Заявки до 15:00. Алматы.\n*Купон 8%*');
 await page.getByRole('button',{name:'Отправить правку',exact:true}).click();
 await page.locator('#wb-result').filter({hasText:/^Заявки/}).waitFor();
 const revision=await page.evaluate(()=>window.syntheticInvokes.at(-1));
 assert.equal(revision.caseId,firstCommunicationCase);
 assert.match(revision.content,/Правка к предыдущему черновику: Вынеси срок подачи заявки в начало/);
 assert.doesNotMatch(revision.content,/777 USD|999 USD/);
 await page.locator('#comms-audience').selectOption('Коллеги');
 await page.locator('#comms-channel').selectOption('Telegram');
 await page.evaluate(()=>window.syntheticCommunicationAnswer='Внутренний бонус 999 USD');
 await page.getByRole('button',{name:'Подготовить черновик',exact:true}).click();
 await page.locator('#wb-error').filter({hasText:'Копирование в этом разделе отключено'}).waitFor();
 assert.equal(await page.locator('#wb-copy,#wb-download,#wb-result').count(),0);
 assert.match(await page.evaluate(()=>window.syntheticInvokes.at(-1).content),/Аудитория: Коллеги\nКанал: Telegram/);
 await page.evaluate(()=>{window.syntheticCommunicationAnswer='';AdvisorWorkbench.reset()});
 if(await page.locator('#shell-menu').isVisible())await page.locator('#shell-menu').click();
 await page.locator('#shell-sidebar [data-section="history"]').click();
 const commsRow=page.locator('#view .item').filter({hasText:'WhatsApp · Клиенты'});
 assert.equal(await commsRow.locator('a[href*="ai-chat.html"]').count(),0);
 await commsRow.locator('[data-action="openresult"]').click();
 await page.locator('#wb-result').waitFor();
 assert.equal(await page.locator('#wb-result').textContent(),'Заявки до 15:00. Алматы.\n*Купон 8%*');
 assert.equal(await page.evaluate(()=>window.syntheticInvokes.length),requestsBeforeCommunication+3);
 await page.locator('#wb-reply').fill('Убери слово «Алматы».');
 await page.evaluate(()=>window.syntheticCommunicationAnswer='Заявки до 15:00.\n*Купон 8%*');
 await page.getByRole('button',{name:'Отправить правку',exact:true}).click();
 await page.locator('#wb-status').filter({hasText:'Результат сохранён'}).waitFor();
 assert.equal(await page.locator('#wb-result').textContent(),'Заявки до 15:00.\n*Купон 8%*');
 assert.equal(await page.evaluate(()=>window.syntheticInvokes.at(-1).caseId),firstCommunicationCase);
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
 await page.evaluate(()=>localStorage.setItem('synthetic-signed-out','1'));
 await page.goto(base+'/tasks-board.html');await page.locator('#task-login:not(.hidden)').waitFor();
 for(const id of ['organize','manual','export-calendar','export-csv','refresh'])assert.equal(await page.locator('#'+id).isDisabled(),true,'Signed-out task action is disabled: '+id);
 assert.deepEqual(errors,[]);console.log('PASS: seven pages, desktop/mobile menus, collapse, keyboard, deep links, history/documents, communications source screening and output gating, print, six inline workbenches and exam replies, chat/task/portfolio draft recovery, logout purge, signup/error UI. Synthetic auth only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
