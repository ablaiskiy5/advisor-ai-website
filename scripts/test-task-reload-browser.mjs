// Production task UI + synthetic cloud fixture. No real Auth, AI or production writes.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(path)]||'text/plain');res.end(await readFile(path))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const fixture=`
(() => {
 const owner=sessionStorage.getItem('fixture-owner')||'11111111-1111-4111-8111-111111111111';
 const read=()=>JSON.parse(sessionStorage.getItem('fixture-cloud')||'{"advisor_tasks":[],"advisor_task_drafts":[]}');
 const write=rows=>sessionStorage.setItem('fixture-cloud',JSON.stringify(rows));
 const db={auth:{getUser:async()=>({data:{user:{id:owner}}}),onAuthStateChange(){}},functions:{invoke:async()=>{
  const rows=read(),id=crypto.randomUUID(),revision=crypto.randomUUID();
  const tasks=[{id:crypto.randomUUID(),title:'Synthetic work task',area:'work',priority:'high',description:'Original details',due_date:''},{id:crypto.randomUUID(),title:'Synthetic sport task',area:'sport',priority:'normal',description:'',due_date:''}];
  rows.advisor_task_drafts=[{id,revision,user_id:owner,source_text:document.getElementById('brain').value,tasks,created_at:new Date().toISOString()}];write(rows);
  sessionStorage.setItem('fixture-ai-count',String(Number(sessionStorage.getItem('fixture-ai-count')||0)+1));return {data:{tasks,draft_id:id,draft_revision:revision}};
 }},from(table){let payload=null,operation='read',single=false,ids=null;const filters=[];const query={
  select(){return this},eq(k,v){filters.push(row=>row[k]===v);return this},in(k,v){ids=v;filters.push(row=>v.includes(row[k]));return this},order(){return this},limit(){return this},range(){return this},maybeSingle(){single=true;return this},single(){single=true;return this},
  update(v){payload=v;operation='update';return this},delete(){operation='delete';return this},upsert(v){payload=v;operation='upsert';return this},insert(v){payload=v;operation='insert';return this},
  then(done){
   const cloud=read(),rows=cloud[table]||[];let selected=rows.filter(row=>row.user_id===owner&&filters.every(fn=>fn(row)));
   if(operation==='read'&&table==='advisor_tasks'&&sessionStorage.getItem('fixture-fail-load')){sessionStorage.removeItem('fixture-fail-load');done({error:{message:'Synthetic initial load failure'}});return}
   if(operation==='update'&&sessionStorage.getItem('fixture-fail-cloud')){done({error:{message:'Synthetic cloud offline'}});return}
   if(operation==='read'&&table==='advisor_tasks'&&ids&&sessionStorage.getItem('fixture-lose-ack')){sessionStorage.removeItem('fixture-lose-ack');done({error:{message:'Synthetic acknowledgement loss'}});return}
   if(operation==='update'){selected.forEach(row=>Object.assign(row,payload));}
   if(operation==='delete')cloud[table]=rows.filter(row=>!selected.includes(row));
   if(operation==='insert'||operation==='upsert'){selected=[];for(const row of Array.isArray(payload)?payload:[payload]){let saved=rows.find(x=>x.id===row.id);if(!saved){saved={id:crypto.randomUUID(),created_at:new Date().toISOString(),...row};rows.push(saved)}selected.push(saved)}cloud[table]=rows;}
   write(cloud);done({data:single?selected[0]||null:selected,error:null});
  }};return query;
 }};window.supabase={createClient:()=>db};})();`;
const browser=await chromium.launch({executablePath:process.env.ADVISOR_CHROMIUM_PATH||undefined,args:process.env.ADVISOR_CHROMIUM_PATH?['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']:[]});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  await context.route('https://**/*',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().includes('supabase-js')?fixture:''}));
  const url='http://127.0.0.1:'+server.address().port+'/tasks-board.html';await page.goto(url);await page.locator('#brain-mic:not([disabled])').waitFor();
  await page.locator('#brain').fill('Synthetic source list: work and sport');await page.locator('#organize').click();await page.locator('#review:not(.hidden) .draft').first().waitFor();
  await page.locator('[data-field="title"]').first().fill('Edited work task');await page.locator('[data-field="include"]').nth(1).uncheck();
  await page.reload();await page.locator('#review:not(.hidden) .draft').first().waitFor();
  assert.equal(await page.locator('[data-field="title"]').first().inputValue(),'Edited work task');assert.equal(await page.locator('[data-field="include"]').nth(1).isChecked(),false);
  await page.locator('#draft-status').filter({hasText:'сохранены в аккаунте'}).waitFor();
  // Remove the local backup: the next reload must recover the server fixture's copy.
  await page.evaluate(()=>{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key.startsWith('advisor-task-review-v1:'))sessionStorage.removeItem(key)}});
  await page.reload();await page.locator('#review:not(.hidden) .draft').first().waitFor();assert.equal(await page.locator('[data-field="title"]').first().inputValue(),'Edited work task');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-ai-count')),'1');
  // Main task write succeeds but acknowledgement fails; reload must not duplicate the task.
  await page.evaluate(()=>sessionStorage.setItem('fixture-lose-ack','1'));await page.locator('#save-drafts').click();await page.locator('#info').filter({hasText:'Не удалось сохранить'}).waitFor();
  await page.reload();await page.locator('#lane-todo .task').waitFor();assert.equal(await page.locator('#lane-todo .task').count(),1);assert.match(await page.locator('#lane-todo').textContent(),/Edited work task/);
  assert.equal(await page.locator('#review').isVisible(),false);assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-ai-count')),'1');
  await page.reload();await page.locator('#lane-todo .task').waitFor();assert.equal(await page.locator('#lane-todo .task').count(),1);
  await page.locator('#lane-todo .task').getByRole('button',{name:'В календарь',exact:true}).click();
  await page.locator('#calendar-editor:not(.hidden)').waitFor();await page.locator('#calendar-date').fill('2026-11-05');await page.locator('#calendar-time').fill('09:45');await page.locator('#calendar-duration').selectOption('60');await page.locator('#calendar-reminder').selectOption('30');
  let calendarUrl=new URL(await page.locator('#calendar-open').getAttribute('href'));assert.equal(calendarUrl.host,'calendar.google.com');assert.equal(calendarUrl.searchParams.get('text'),'Edited work task');
  for(const provider of ['microsoft365','outlook']){await page.locator('#calendar-provider').selectOption(provider);calendarUrl=new URL(await page.locator('#calendar-open').getAttribute('href'));assert.equal(calendarUrl.searchParams.get('startdt'),'2026-11-05T04:45:00.000Z');assert.equal(calendarUrl.host,provider==='outlook'?'outlook.live.com':'outlook.office.com')}
  await page.locator('#calendar-provider').selectOption('iphone');assert.equal(await page.locator('#calendar-open').isVisible(),false);
  const fileReady=page.waitForEvent('download');await page.locator('#calendar-download').click();const exported=await fileReady,calendarFile=await readFile(await exported.path(),'utf8');
  assert.match(calendarFile,/SUMMARY:Edited work task/);assert.match(calendarFile,/DTSTART:20261105T044500Z/);assert.match(calendarFile,/DTEND:20261105T054500Z/);assert.match(calendarFile,/TRIGGER:-PT30M/);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-ai-count')),'1','Calendar handoff never invokes AI');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Calendar form fits mobile');await page.locator('#calendar-close').click();
  const original=page.locator('#lane-todo .task').filter({hasText:'Edited work task'});
  await page.locator('#scope-filters').getByRole('button',{name:'Активные',exact:true}).click();
  await original.getByRole('button',{name:'В работу',exact:true}).click();
  const inProgress=page.locator('#lane-doing .task').filter({hasText:'Edited work task'});
  await inProgress.getByRole('button',{name:'✓ Готово',exact:true}).click();
  const completed=page.locator('#lane-done .task').filter({hasText:'Edited work task'});
  await completed.waitFor();
  assert.equal(await inProgress.count(),0);
  assert.equal(await page.locator('#scope-filters').getByRole('button',{name:'Все',exact:true}).getAttribute('aria-pressed'),'true');
  await page.reload();await completed.waitFor();
  await page.locator('#scope-filters').getByRole('button',{name:'Готово',exact:true}).click();
  await page.locator('#lane-done .task').getByRole('button',{name:'Вернуть',exact:true}).click();await page.locator('#scope-filters').getByRole('button',{name:'Активные',exact:true}).click();
  await original.getByRole('button',{name:'Дата / правка',exact:true}).click();await page.locator('#edit-due').fill('2026-11-06');await page.locator('#edit-description').fill('Updated task details');await page.locator('#edit-form button[type="submit"]').click();await page.locator('#task-editor').waitFor({state:'hidden'});
  await page.locator('#manual').click();await page.locator('#edit-title').fill('Synthetic manual follow-up');await page.locator('#edit-due').fill('2026-11-07');await page.locator('#edit-form button[type="submit"]').click();await page.locator('#task-editor').waitFor({state:'hidden'});
  await page.reload();await page.locator('#lane-todo .task').filter({hasText:'Synthetic manual follow-up'}).waitFor();assert.equal(await page.locator('#lane-todo .task').count(),2);assert.match(await page.locator('#lane-todo').textContent(),/Updated task details/);
  for(const [id,pattern] of [['export-csv',/Synthetic manual follow-up/],['export-calendar',/BEGIN:VEVENT/]]){
   const ready=page.waitForEvent('download');await page.locator('#'+id).click();const downloaded=await ready,text=await readFile(await downloaded.path(),'utf8');assert.match(text,pattern);
  }
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-ai-count')),'1','Task edits, status changes and exports do not invoke AI');
  await page.evaluate(()=>sessionStorage.setItem('fixture-fail-load','1'));await page.reload();await page.locator('#info').filter({hasText:'Synthetic initial load failure'}).waitFor();
  await page.locator('#refresh').click();await page.locator('#lane-todo .task').filter({hasText:'Synthetic manual follow-up'}).waitFor();assert.equal(await page.locator('#lane-todo .task').count(),2,'Refresh recovers after initial load failure');
  await page.evaluate(()=>sessionStorage.setItem('fixture-owner','33333333-3333-4333-8333-333333333333'));await page.reload();await page.locator('#brain-mic:not([disabled])').waitFor();
  assert.equal(await page.locator('#lane-todo .task').count(),0);assert.equal(await page.locator('#review').isVisible(),false);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: task review/reload, idempotent saves, owner separation, Google/Outlook handoff and timed ICS alarm download. Synthetic cloud; no real provider event is created.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
