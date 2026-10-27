import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const fragment=source.slice(source.indexOf('function settings()'),source.indexOf('async function authenticate(mode)'));
function settings(isLogged, recovery=false){
 return runInNewContext(fragment+';settings()',{
  passwordRecovery:recovery,session:isLogged?{user:{email:'demo@example.com'}}:null,
  isCloud:()=>isLogged,esc:s=>s,pageTitle:(title,sub)=>title+' '+sub
 });
}
test('signed in account keeps backup and refresh behind optional advanced section',()=>{
 const html=settings(true);
 assert.match(html,/Аккаунт подключён/);
 assert.match(html,/загружаются автоматически/);
 assert.match(html,/<details class="account-advanced"/);
 assert.ok(html.indexOf('К работе')<html.indexOf('Скачать копию кейсов'));
 assert.match(html,/не включает AI-переписку/);
 assert.match(html,/data-action="refresh"/);
});
test('registration has no technical JSON controls',()=>{
 const html=settings(false);
 assert.match(html,/① Зарегистрироваться/);
 assert.doesNotMatch(html,/Импорт JSON|Скачать копию кейсов|Повторно загрузить кейсы/);
});
test('password recovery stays accessible',()=>{
 const html=settings(true,true);
 assert.match(html,/id="new-password"/);
 assert.doesNotMatch(html,/Резервная копия/);
});
test('login opens the Home screen',()=>assert.match(source,/page=nextOwner\?'home':'settings'/));
