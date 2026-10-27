import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const start=html.indexOf('function formatMessengerText('),end=html.indexOf('async function copyMessenger(',start);
assert.ok(start>=0&&end>start,'production messenger formatter exists');
const format=runInNewContext(html.slice(start,end)+';formatMessengerText');
test('WhatsApp receives single-star bold and underscore italic',()=>{
 const value=format('## Вывод\n**Покупать частями** — *не гарантия*.\n- риск высокий','whatsapp');
 assert.equal(value,'*Вывод*\n*Покупать частями* — _не гарантия_.\n• риск высокий');
});
test('Telegram keeps double-star bold and double-underscore italics',()=>{
 const value=format('## Идея\n**Риск** и *горизонт*.\n- акция','telegram');
 assert.equal(value,'**Идея**\n**Риск** и __горизонт__.\n• акция');
});
test('copying is an explicit opt-in and never auto-sends a client message',()=>{
 assert.match(html,/id="copy-whatsapp"/);
 assert.match(html,/id="copy-telegram"/);
 assert.match(html,/navigator.clipboard.writeText\(formatted\)/);
 assert.match(html,/v\|\|!lastAnswer/);
 assert.match(html,/isCurrentChat\(epoch,ownerId\)/);
 assert.doesNotMatch(html.slice(start,html.indexOf('function setStatus(',start)),/fetch\(|\.insert\(|\.invoke\(/);
});
