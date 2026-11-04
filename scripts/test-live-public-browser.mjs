// Public live-browser walkthrough. No credentials, private cases, paid AI, or real user data.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const site = 'https://ablaiskiy5.github.io/advisor-ai-website/';
const pages = ['workspace.html','ai-chat.html','portfolio-report.html','bond-analysis.html','ideas-risk-budget.html','tasks-board.html','tools-health.html'];
const browser = await chromium.launch({executablePath:process.env.ADVISOR_CHROMIUM_PATH||undefined,args:process.env.ADVISOR_CHROMIUM_PATH?['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']:[]});
const context = await browser.newContext({viewport:{width:1440,height:900}});
const page = await context.newPage();
const paidCalls = [];
page.on('request', req=> {if(/\/functions\/v1\/(advisor-ai-chat|advisor-ai-organize-tasks)(\?|$)/.test(req.url())) paidCalls.push(req.url().replace(/\?.*/,''));});
try {
  // Real public landing -> login route click, without trying an account.
  let response=await page.goto(site+'index.html',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response.status(),200);
  await page.locator('a[href="workspace.html"]').first().click();
  await page.waitForURL(/workspace\.html/);
  await page.locator('#shell-sidebar nav a').first().waitFor({timeout:15000});
  assert.equal(await page.locator('#shell-sidebar nav a').count(),10+await page.locator('#shell-sidebar [data-section="communications"]').count());
  // Real desktop collapse -> expand.
  await page.locator('#shell-collapse').click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('shell-collapsed')),true);
  await page.locator('#shell-collapse').click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('shell-collapsed')),false);
  // All public app routes load and shared navigation becomes active.
  for(const name of pages) {
    response=await page.goto(site+name,{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(response.status(),200,name+' response');
    await page.locator('#shell-sidebar nav a').first().waitFor({timeout:15000});
    assert.equal(await page.locator('#shell-sidebar nav a').count(),10+await page.locator('#shell-sidebar [data-section="communications"]').count(),name+' menu');
  }
  // Actual local bond-calculator button, independent of account and AI.
  await page.goto(site+'bond-analysis.html',{waitUntil:'domcontentloaded'});
  await page.locator('#example').click();
  await assert.doesNotReject(async()=> {
    await page.waitForFunction(()=>/6[.,]3/.test(document.querySelector('#current')?.textContent||''),null,{timeout:6000});
  },'bond example calculation must display approximately 6.32%');
  assert.equal((await page.locator('#error').innerText()).trim(),'','bond example must have no error');
  // Actual multi-position budget button and derived computation.
  await page.goto(site+'ideas-risk-budget.html',{waitUntil:'domcontentloaded'});
  await page.locator('#example').click();
  const budget=await page.locator('#budget').innerText();
  assert.match(budget,/100[\s,.\u00a0]*000/,'example 10% portfolio pool');
  assert.equal(await page.locator('#positions tr').count(),4,'four example positions');
  await page.locator('#add').click();
  assert.equal(await page.locator('#positions tr').count(),5,'add position button');
  // Actual mobile nav open, escape, and navigate to tasks.
  await page.setViewportSize({width:390,height:844});
  await page.goto(site+'workspace.html',{waitUntil:'domcontentloaded'});
  await page.locator('#shell-menu').waitFor();
  await page.locator('#shell-menu').click();
  assert.equal(await page.locator('#shell-menu').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#shell-menu').getAttribute('aria-expanded'),'false');
  await page.locator('#shell-menu').click();
  await page.locator('#shell-sidebar a[data-section="tasks"]').click();
  await page.waitForURL(/tasks-board\.html/);
  // Browser-origin public diagnostics, separate from a model tool call.
  await page.setViewportSize({width:1440,height:900});
  await page.goto(site+'tools-health.html',{waitUntil:'domcontentloaded'});
  await page.locator('#test').click();
  await page.waitForFunction(()=>document.querySelector('#test')?.disabled===false && /проверок пройдены|из 8 проверок/.test(document.querySelector('#overall')?.textContent||''),null,{timeout:90000});
  assert.match(await page.locator('#overall').innerText(),/Все 8 проверок пройдены/);
  assert.equal(paidCalls.length,0,'public demo navigation must not call paid/private AI');
  console.log('PASS: real public browser clicked landing/login route, desktop/mobile menus, bond example, risk example/add, tasks nav and all 8 MCP health checks.');
  console.log('LIMITATION: public clicks cannot verify real login, private cases, user-level isolation or paid AI output.');
} finally {
  await browser.close();
}
