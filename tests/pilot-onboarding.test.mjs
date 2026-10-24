import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
test('onboarding states independent email/password accounts, not ChatGPT SSO',()=>{
 assert.match(page,/Каждый сотрудник создаёт отдельный аккаунт/);
 assert.match(page,/Это не вход через ChatGPT/);
});
test('onboarding explains verification and initial AI quota',()=>{
 assert.match(page,/подтверди адрес, затем войди/);
 assert.match(page,/до 10 запросов за 24 часа/);
 assert.match(page,/только для заранее разрешённых адресов/);
});
test('onboarding blocks confidential client data during pilot',()=>{
 assert.match(page,/Не загружай ФИО, номера счетов, документы клиентов/);
});
