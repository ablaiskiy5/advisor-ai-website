import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('async function authenticate(mode)'),html.indexOf('async function forgotPassword()'));
test('auth failures and thrown network errors give actionable Russian feedback',async()=>{
 for(const [error,pattern] of [[{code:'invalid_credentials'},/Неверный email или пароль/],[{code:'email_not_confirmed'},/подтверди email/],[{code:'weak_password'},/Пароль слишком простой/],[{status:429,message:'after 30 seconds'},/30 секунд/],[null,/Проверь интернет/]]){
  const messages=[];const api=runInNewContext(code+';authenticate',{document:{getElementById:id=>({value:id==='login-email'?'synthetic@example.invalid':'password123'})},cloud:{auth:{signInWithPassword:async()=>{if(!error)throw Error('network');return{data:null,error}}}},toast:x=>messages.push(x)});
  await api('login');assert.match(messages.at(-1),pattern);
 }
});
test('registration feedback remains beside the form after the toast expires',()=>{
 const node={textContent:'',classList:{remove(){}},style:{}},toastNode={textContent:'',style:{}};let timer;
 const start=html.indexOf('function toast(s)'),end=html.indexOf('const fmt=',start);
 const toast=runInNewContext(html.slice(start,end)+';toast',{document:{getElementById:id=>id==='auth-feedback'?node:toastNode},clearTimeout(){},setTimeout:fn=>{timer=fn}});
 toast('Synthetic confirmation');timer();assert.equal(node.textContent,'Synthetic confirmation');assert.equal(toastNode.style.display,'none');assert.equal(node.style.display,undefined);
 assert.match(html,/id="auth-feedback" class="notice hide" role="status"/);
});
