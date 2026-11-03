import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ctx={URL,URLSearchParams,TextEncoder};runInNewContext(readFileSync(new URL('../assets/task-calendar.js',import.meta.url),'utf8'),ctx);
const api=ctx.AdvisorTaskCalendar,task={id:'synthetic-task',title:'Встреча & план',description:'Полные детали встречи'};
const options={date:'2026-11-04',time:'09:00',duration:30,reminder:15};
test('Kazakhstan appointment keeps exact UTC+5 time and duration',()=>{
 const e=api.event(task,options);assert.equal(e.start,'2026-11-04T04:00:00.000Z');assert.equal(e.end,'2026-11-04T04:30:00.000Z');
});
test('Google and both Outlook links preserve fields without query injection',()=>{
 const e=api.event(task,options),google=new URL(api.link(e,'google'));
 assert.equal(google.host,'calendar.google.com');assert.equal(google.searchParams.get('text'),task.title);assert.equal(google.searchParams.get('dates'),'20261104T040000Z/20261104T043000Z');
 for(const provider of ['outlook','microsoft365']){const u=new URL(api.link(e,provider));assert.equal(u.searchParams.get('subject'),task.title);assert.equal(u.searchParams.get('startdt'),e.start);assert.equal(u.searchParams.get('body'),task.description);assert.match(u.host,/^outlook\.(live|office)\.com$/)}
});
test('ICS contains private timed event, stable UID and selected alarm',()=>{
 const ics=api.ics(api.event(task,options),0);assert.match(ics,/DTSTART:20261104T040000Z\r\n/);assert.match(ics,/DTEND:20261104T043000Z/);assert.match(ics,/UID:synthetic-task@advisor-ai.local/);assert.match(ics,/BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M/);assert.match(ics,/CLASS:PRIVATE/);assert.ok(ics.endsWith('\r\n'));
 assert.doesNotMatch(api.ics(api.event(task,{...options,reminder:null})),/VALARM/);
});
test('untrusted text cannot inject an extra calendar event and UTF-8 lines remain folded',()=>{
 const t={...task,title:'Тест\r\nBEGIN:VEVENT\r\nSUMMARY:Injected',description:'😀 Привет, мир; '.repeat(160)};
 const ics=api.ics(api.event(t,options));assert.equal(ics.split('\r\n').filter(x=>x==='BEGIN:VEVENT').length,1);
 for(const line of ics.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);
 assert.ok(ics.replace(/\r\n /g,'').includes('😀 Привет\\, мир\\;'));
});
test('invalid dates, time, reminders and oversized links fail instead of changing event data',()=>{
 for(const patch of [{date:'2026-02-31'},{time:'25:00'},{duration:0},{reminder:-10}])assert.throws(()=>api.event(task,{...options,...patch}));
 const e=api.event({...task,description:'Полный текст '.repeat(2000)},options);assert.throws(()=>api.link(e,'google'),/слишком длинное/);assert.ok(api.ics(e).replace(/\r\n /g,'').includes('Полный текст '.repeat(2000)));
});
