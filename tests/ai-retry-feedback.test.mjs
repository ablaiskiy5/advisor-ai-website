import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
test('retry exhaustion disables repeated calls and offers new question',()=>{
 assert.match(page,/Лимит повторных попыток/);
 assert.match(page,/if\(exhausted\)\{\s*\$\('retry'\)\.classList\.add\('hidden'\)/);
 assert.match(page,/Три попытки обработки этого сообщения использованы/);
});
test('quota and pilot access failures have actionable guidance',()=>{
 assert.match(page,/Подожди восстановления лимита за 24 часа/);
 assert.match(page,/подтверждённый email из списка участников пилота/);
 assert.match(page,/не более трёх попыток на вопрос/);
});