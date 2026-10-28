import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../ai-chat.html',import.meta.url),'utf8');
const start=html.indexOf('function guidanceFor('),end=html.indexOf('function updateInputGuidance',start);
const guidance=runInNewContext(html.slice(start,end)+';guidanceFor');
test('portfolio, options and bonds ask for task-specific necessary data without fabricated quotes',()=>{
 assert.match(guidance('portfolio'),/тикер, количество, стоимость/);
 assert.match(guidance('portfolio','covered call NVDA'),/актуальная опционная цепочка с датой/);
 assert.match(guidance('ideas','покрытый колл'),/премии будут только условными/);
 assert.match(guidance('ideas','ISIN XS0000000000'),/дата расчёта, цена, график купонов/);
 assert.match(guidance('ideas'),/достаточно темы/);
 assert.match(guidance('academy'),/начать с нуля/);
});
test('answer depth is optional and preserves the original question without silently truncating',()=>{
 const send=html.slice(html.indexOf('async function send()'),html.indexOf('const quickOptions='));
 assert.match(html,/<option value="auto">По задаче<\/option>/);
 assert.match(send,/const typed=rawTyped\+\(rawTyped\?depthNote:''\)/);
 assert.match(send,/if\(typed.length>5000\)/);
 assert.doesNotMatch(send,/typed\.slice\(/);
});
