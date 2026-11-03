/* Calendar handoff only: preparing links/files never writes to an external account. */
(() => {
 'use strict';
 const esc=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 function fold(line){let out='',part='',bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>75){out+=part+'\r\n';part=' ';bytes=1}part+=char;bytes+=n}return out+part}
 function event(task,options){
  const date=String(options.date||''),time=String(options.time||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Укажи корректные дату и время.');
  if(![15,30,60,120].includes(Number(options.duration)))throw Error('Выбери длительность события.');
  if(![null,0,5,15,30,60,1440].includes(options.reminder===null?null:Number(options.reminder)))throw Error('Выбери время напоминания.');
  const dateCheck=new Date(date+'T00:00:00Z');if(!Number.isFinite(+dateCheck)||dateCheck.toISOString().slice(0,10)!==date)throw Error('Такой даты нет в календаре.');
  const start=new Date(date+'T'+time+':00+05:00'),end=new Date(+start+Number(options.duration)*60000);
  if(!task.id||!String(task.title||'').trim())throw Error('Задача не найдена.');
  return {id:task.id,title:String(task.title),description:String(task.description||''),start:start.toISOString(),end:end.toISOString(),reminder:options.reminder===null?null:Number(options.reminder)};
 }
 const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 function ics(e,now=Date.now()){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Advisor AI//Task Calendar//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+String(e.id).replace(/[^a-zA-Z0-9_-]/g,'')+'@advisor-ai.local','DTSTAMP:'+stamp(now),'DTSTART:'+stamp(e.start),'DTEND:'+stamp(e.end),'SUMMARY:'+esc(e.title),'DESCRIPTION:'+esc(e.description),'CLASS:PRIVATE','STATUS:CONFIRMED'];
  if(e.reminder!==null)lines.push('BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:'+(e.reminder===0?'PT0M':'-PT'+e.reminder+'M'),'DESCRIPTION:'+esc(e.title),'END:VALARM');
  lines.push('END:VEVENT','END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
 }
 function link(e,provider){
  let url;
  if(provider==='google'){
   url=new URL('https://calendar.google.com/calendar/render');url.search=new URLSearchParams({action:'TEMPLATE',text:e.title,dates:stamp(e.start)+'/'+stamp(e.end),details:e.description,ctz:'Asia/Almaty'}).toString();
  }else if(provider==='outlook'||provider==='microsoft365'){
   url=new URL(provider==='outlook'?'https://outlook.live.com/calendar/0/deeplink/compose':'https://outlook.office.com/calendar/0/deeplink/compose');url.search=new URLSearchParams({path:'/calendar/action/compose',rru:'addevent',subject:e.title,startdt:e.start,enddt:e.end,body:e.description,allday:'false'}).toString();
  }else throw Error('Выбери поддерживаемый календарь.');
  if(url.href.length>7500)throw Error('Описание слишком длинное для ссылки. Скачай файл .ics: в нём сохранится полный текст.');
  return url.href;
 }
 globalThis.AdvisorTaskCalendar={event,ics,link};
})();
