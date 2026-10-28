/* Section-specific workflows using the existing authenticated case/message AI backend. */
(() => {
 'use strict';
 const configs={
  'ideas:company':{title:'Инвестиционный разбор компании',label:'Компания или тикер',placeholder:'Например: NVDA — устойчивость роста и оценка',action:'Получить разбор',type:'company',hint:'Достаточно компании или тикера. Горизонт и цель — по желанию.',policy:'Дай готовый инвестиционный разбор, а не приветствие. Структура: вывод; тезис и драйверы; оценка и ключевые показатели с датами; риски; практические сценарии. Отделяй факты от оценки. Не повторяй вопросы, на которые уже есть ответ. Если актуальные данные недоступны, укажи это и дай предварительный анализ без выдуманных цен.'},
  'ideas:sector':{title:'Идеи по сектору',label:'Сектор или инвестиционная тема',placeholder:'Например: энергетика, защитные ETF, инфраструктура AI',action:'Подобрать идеи',type:'sector',hint:'AI сравнит до пяти инструментов по одной логике, с аргументами и рисками.',policy:'Предложи до 5 подходящих инструментов. Сначала короткий вывод, затем сравнительная таблица: инструмент, роль в портфеле, драйвер, главный риск. Заверши критериями выбора. Не выдавай устаревшие цены за текущие; источники и даты для актуальных утверждений обязательны. Не называй рискованные темы защитными без объяснения.'},
  'markets:review':{title:'Разбор рыночного события',label:'Что нужно объяснить?',placeholder:'Например: почему падает Nasdaq и что это меняет для портфеля?',action:'Разобрать событие',type:'event',hint:'Укажи событие или задай вопрос. Для текущих событий нужны проверенные источники.',policy:'Ответь на конкретный вопрос. Сначала главный вывод, затем подтверждённые причины с датами/источниками, цепочка влияния на активы и что отслеживать. Разделяй наблюдения и гипотезы. Не приписывай движению рынка причину без подтверждения. При отсутствии веб-подтверждения прямо укажи ограничение.'},
  'markets:scenario':{title:'Карта макросценариев',label:'Какой исходный шок рассматриваем?',placeholder:'Например: рост нефти на 20% при замедлении экономики',action:'Построить сценарии',type:'scenario',hint:'Опиши исходное условие. Расчётный сценарий не является прогнозом котировок.',policy:'Построй базовый, благоприятный и неблагоприятный сценарии. Покажи механизм: шок → инфляция/рост → ЦБ/доходности → валюты и активы. Таблица: условие, влияние, индикатор подтверждения, практическое действие. Не придумывай вероятности или точные уровни без данных.'},
  'academy:learn':{title:'Учебный разбор',label:'Какую тему изучаем?',placeholder:'Например: дюрация, covered call, WACC, инфляция',action:'Начать урок',type:'lesson',hint:'Получишь объяснение, пример и короткую самопроверку на выбранном уровне.',policy:'Проведи короткий урок на указанном уровне: суть простыми словами; причинный механизм; один практический пример с явными допущениями; типичная ошибка; один вопрос для самопроверки. Не начинай с анкеты и не отвечай за ученика на вопрос самопроверки.'},
  'academy:exam':{title:'Тренировка аттестации',label:'Тема или область экзамена',placeholder:'Например: опционы, облигации, фундаментальный анализ',action:'Получить первый вопрос',type:'exam',hint:'AI задаёт один вопрос. Ответь своими словами — получишь оценку и следующий вопрос.',policy:'Ты экзаменатор финансового советника. На старте задай ровно один вопрос по теме и уровню, без ответа и подсказок. После ответа ученика: оцени 0–5 с кратким обоснованием, исправь конкретные ошибки, покажи правильную логику и задай один следующий вопрос. Не выставляй оценку до ответа ученика.'}
 };
 let hooks=null;const states=new Map(),selected=new Map();
 const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stateFor=kind=>states.get(selected.get(kind));
 const policySuffix='Отвечай по существу, без общих вступлений и повторения запроса. Используй только необходимые уточнения: если можно сделать предварительный вывод, сделай его. Сложность и длина должны соответствовать задаче. Не сообщай о выполненных внешних действиях без реального инструмента.';
 function supports(kind,flow){return Object.hasOwn(configs,kind+':'+flow)}
 function fresh(key){const [kind,flow]=key.split(':');return {key,kind,flow,subject:'',context:'',horizon:'',level:'Базовый',reply:'',answer:'',status:'',error:'',pending:false,caseData:null,message:null,attempts:0,readOnly:false,blocked:false,fromHistory:false}}
 function open(kind,flow){if(!supports(kind,flow))return;const key=kind+':'+flow;selected.set(kind,key);if(!states.has(key))states.set(key,fresh(key))}
 function matchCase(e){return Object.keys(configs).find(key=>key.startsWith(e.kind+':')&&typeof e.prompt==='string'&&e.prompt.startsWith(configs[key].policy))||''}
 function markup(kind){
  const s=stateFor(kind);if(!s)return '';const c=configs[s.key],locked=s.pending?' disabled':'';
  const options=c.type==='lesson'||c.type==='exam'?'<label class="label" for="wb-level">Уровень</label><select class="field" id="wb-level"'+locked+'>'+['Базовый','Практический','Продвинутый'].map(v=>'<option'+(s.level===v?' selected':'')+'>'+v+'</option>').join('')+'</select>':'<label class="label" for="wb-horizon">Горизонт (необязательно)</label><input class="field" id="wb-horizon" maxlength="100" placeholder="Например: 6–12 месяцев" value="'+escape(s.horizon)+'"'+locked+'>';
  return '<section class="workbench panel" aria-label="'+escape(c.title)+'"><div class="eyebrow">РАБОЧАЯ ОБЛАСТЬ</div><h2>'+(s.fromHistory?escape(s.caseData.title):c.title)+'</h2><p class="note">'+c.hint+'</p>'+(s.fromHistory?'<details class="wb-new"><summary>Новый разбор (необязательно)</summary>':'')+'<form id="wb-form"><label class="label" for="wb-subject">'+c.label+'</label><textarea class="field" id="wb-subject" maxlength="1800" required placeholder="'+c.placeholder+'"'+locked+'>'+escape(s.subject)+'</textarea><div class="wb-options">'+options+'<label class="label" for="wb-context">Цель или контекст (необязательно)</label><textarea class="field" id="wb-context" maxlength="1200" placeholder="Что важно учесть?"'+locked+'>'+escape(s.context)+'</textarea></div><div class="tools"><button class="btn primary" type="submit"'+locked+'>'+ (s.pending?'Готовлю результат…':s.answer?'Запустить новый разбор':c.action)+'</button><span class="note">Результат сохраняется в истории. Запрос расходует лимит AI.</span></div></form>'+(s.fromHistory?'</details>':'')+'<p id="wb-status" class="wb-status" role="status" aria-live="polite"></p><p id="wb-error" class="wb-error" role="alert"></p>'
  +(s.fromHistory?'<p class="note">Открыт сохранённый результат. Новый запуск использует данные формы выше.</p>':'')+'<div class="tools">'+(s.message&&!s.pending&&!s.blocked&&!s.answer?'<button id="wb-retry" class="btn">'+(s.readOnly?'Обновить результат без AI-запроса':'Повторить получение результата')+'</button>':'')+(s.caseData&&!s.pending?'<a class="btn" href="./ai-chat.html?case='+encodeURIComponent(s.caseData.id)+'">Обсудить в чате / полная история →</a>':'')+'</div>'
  +(s.answer?'<article class="wb-result" id="wb-result" aria-label="Результат Advisor AI"></article><div class="tools"><button class="btn" id="wb-copy">Копировать результат</button><button class="btn" id="wb-download">Скачать текст</button></div>':'')
  +(s.answer&&c.type==='exam'?'<form id="wb-reply-form"><label class="label" for="wb-reply">Твой ответ</label><textarea class="field" id="wb-reply" maxlength="3000" required placeholder="Ответь своими словами…"'+locked+'>'+escape(s.reply)+'</textarea><button class="btn primary" type="submit"'+locked+'>Получить оценку и следующий вопрос</button></form>':'')+'</section>';
 }
 function update(s){if(selected.get(s.kind)===s.key)hooks?.onUpdate(s.kind)}
 function current(s,owner,epoch){return hooks?.owner()===owner&&hooks?.epoch()===epoch&&states.get(s.key)===s}
 function prompt(s){const c=configs[s.key];return c.title+'\nТема: '+s.subject.trim()+(s.horizon.trim()?'\nГоризонт: '+s.horizon.trim():'')+(['lesson','exam'].includes(c.type)?'\nУровень: '+s.level:'')+(s.context.trim()?'\nЦель и контекст: '+s.context.trim():'')+'\n'+c.policy+'\n'+policySuffix}
 async function readResult(s,owner,epoch){
  const m=s.message;if(!m)return false;
  const {data,error}=await hooks.db().from('advisor_ai_messages').select('id,case_id,user_id,role,content,created_at').eq('case_id',s.caseData.id).eq('user_id',owner).eq('role','assistant').gte('created_at',m.created_at).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!current(s,owner,epoch))return false;
  if(error)throw Error('Не удалось обновить результат. Открой историю или повтори обновление без нового AI-запроса.');
  if(!data)return false;
  if(data.case_id!==s.caseData.id||data.user_id!==owner||data.role!=='assistant'||typeof data.content!=='string'||!data.content.trim()||!Number.isFinite(Date.parse(data.created_at))||Date.parse(data.created_at)<Date.parse(m.created_at))throw Error('Не удалось подтвердить результат этого запроса. Открой полную историю.');
  s.answer=data.content;s.status='Результат сохранён в личной истории.';s.error='';s.readOnly=false;return true;
 }
 async function generate(s,retry=false,reply=false){
  if(s.pending||!hooks?.owner())return;
  const owner=hooks.owner(),epoch=hooks.epoch();
  if(!retry&&!reply&&(!s.subject.trim()||s.subject.length>1800||s.context.length>1200||s.horizon.length>100)){s.error='Укажи тему и сократи слишком длинный контекст.';update(s);return}
  if(reply&&(!s.reply.trim()||s.reply.length>3000)){s.error='Напиши свой ответ (до 3000 символов).';update(s);return}
  s.pending=true;s.error='';s.status=retry?'Проверяю сохранённый результат…':'Готовлю результат…';update(s);
  try{
   if(retry){if(await readResult(s,owner,epoch))return;if(!current(s,owner,epoch))return;if(s.readOnly)throw Error('Сервер сообщил о сохранении, но результат пока не загрузился. Обнови ещё раз или открой историю.');}
   else{
    if(!reply){s.fromHistory=false;s.caseData=null;s.message=null;s.answer='';s.attempts=0;s.blocked=false;s.readOnly=false;const e=hooks.makeCase(s.kind);e.title=(configs[s.key].title+': '+s.subject.trim()).slice(0,180);e.prompt=configs[s.key].policy+'\n'+policySuffix;if(!await hooks.persist(e)||!current(s,owner,epoch)){if(current(s,owner,epoch))throw Error('Создание работы не подтверждено. Обнови историю перед повтором.');return}s.caseData=e;}
    const content=reply?'Мой ответ на последний экзаменационный вопрос: '+s.reply.trim()+'\nОцени ответ, объясни ошибки и задай один следующий вопрос.':prompt(s);
    const {data,error}=await hooks.db().from('advisor_ai_messages').insert({case_id:s.caseData.id,user_id:owner,role:'user',content}).select('id,case_id,user_id,role,content,created_at').single();
    if(!current(s,owner,epoch))return;
    if(error||!data?.id||data.case_id!==s.caseData.id||data.user_id!==owner||data.role!=='user'||data.content!==content||!Number.isFinite(Date.parse(data.created_at))){s.blocked=true;throw Error('Отправка не подтверждена. Открой историю перед повтором, чтобы избежать дублей.');}
    s.message=data;s.attempts=0;s.answer='';s.readOnly=false;if(reply)s.reply='';globalThis.AdvisorDrafts?.acknowledge(reply?['wb-reply']:['wb-subject','wb-context','wb-horizon','wb-level']);
   }
   if(s.attempts>=3){s.blocked=true;throw Error('Три попытки по этому запросу использованы. Продолжи в истории или начни новый разбор.');}
   s.attempts++;
   const {data,error}=await hooks.db().functions.invoke('advisor-ai-chat',{body:{case_id:s.caseData.id}});
   if(!current(s,owner,epoch))return;
   if(error){let detail='';try{detail=(await error.context?.json())?.error||''}catch{}if(!current(s,owner,epoch))return;throw Error(detail||error.message||'AI временно недоступен.');}
   if(data?.error)throw Error(data.error);
   s.readOnly=true;
   if(!await readResult(s,owner,epoch)&&current(s,owner,epoch))throw Error('AI завершил запрос, но результат ещё не загрузился. Обнови результат без нового AI-запроса.');
  }catch(error){if(current(s,owner,epoch)){s.error=String(error.message||error);s.status=s.caseData?'Работа сохранена. Можно открыть полную историю.':'';if(/лимит.*(?:достигнут|исчерпан)|(?:достигнут|исчерпан).*лимит|отключён|не разрешён|retry_limit/i.test(s.error))s.blocked=true;}}
  finally{if(current(s,owner,epoch)){s.pending=false;update(s)}}
 }
 async function resume(e){
  const key=matchCase(e);if(!key||!hooks?.owner())return;
  if(states.get(key)?.pending){selected.set(e.kind,key);update(states.get(key));return}
  const s=fresh(key),owner=hooks.owner(),epoch=hooks.epoch();s.fromHistory=true;s.caseData=e;s.pending=true;s.status='Загружаю сохранённый результат…';states.set(key,s);selected.set(e.kind,key);update(s);
  try{
   const {data,error}=await hooks.db().from('advisor_ai_messages').select('id,case_id,user_id,role,content,created_at').eq('case_id',e.id).eq('user_id',owner).order('created_at',{ascending:false}).limit(80);
   if(!current(s,owner,epoch))return;
   if(error||!Array.isArray(data))throw Error('Не удалось загрузить результат. Повторно открой его из истории.');
   if(data.some(row=>row.case_id!==e.id||row.user_id!==owner||typeof row.content!=='string'||!Number.isFinite(Date.parse(row.created_at))))throw Error('Данные результата не подтверждены. Открой полную историю.');
   s.message=data.find(row=>row.role==='user')||null;
   const answer=data.find(row=>row.role==='assistant');
   if(answer&&(!s.message||Date.parse(answer.created_at)>=Date.parse(s.message.created_at))){s.answer=answer.content;s.status='Сохранённый результат загружен без AI-запроса.';}
   else s.status=s.message?'В истории есть вопрос без ответа. Можно повторить получение результата.':'В этой работе ещё нет ответа. Можно начать новый разбор.';
  }catch(error){if(current(s,owner,epoch))s.error=String(error.message||error)}
  finally{if(current(s,owner,epoch)){s.pending=false;update(s)}}
 }
 function mount(kind){
  const s=stateFor(kind);if(!s||!$('wb-form'))return;
  globalThis.AdvisorDrafts?.bind(hooks?.owner(),'workbench:'+s.key,['wb-subject','wb-context','wb-horizon','wb-level','wb-reply']);
  const sync=()=>{for(const [id,key]of[['wb-subject','subject'],['wb-context','context'],['wb-horizon','horizon'],['wb-level','level'],['wb-reply','reply']])if($(id))s[key]=$(id).value};sync();
  for(const id of ['wb-subject','wb-context','wb-horizon','wb-level','wb-reply'])if($(id))$(id).addEventListener('input',sync);
  $('wb-form').onsubmit=e=>{e.preventDefault();sync();void generate(s)};
  if($('wb-reply-form'))$('wb-reply-form').onsubmit=e=>{e.preventDefault();sync();void generate(s,false,true)};
  if($('wb-retry'))$('wb-retry').onclick=()=>void generate(s,true);
  $('wb-status').textContent=s.status;$('wb-error').textContent=s.error;
  if(s.answer){if(typeof renderAnswerSafe==='function')renderAnswerSafe($('wb-result'),s.answer);else $('wb-result').textContent=s.answer;if(s.pending)$('wb-result').setAttribute('aria-busy','true');
   $('wb-copy').onclick=async()=>{try{if(!hooks.owner())return;await navigator.clipboard.writeText(s.answer);s.status='Результат скопирован.';update(s)}catch{s.error='Не удалось скопировать. Выдели текст результата вручную.';update(s)}};
   $('wb-download').onclick=()=>{if(!hooks.owner())return;const url=URL.createObjectURL(new Blob([s.answer],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='AdvisorAI-'+s.kind+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
  }
 }
 function reset(){states.clear();selected.clear()}
 globalThis.AdvisorWorkbench={configure:x=>hooks=x,supports,open,markup,mount,reset,resume,matches:e=>Boolean(matchCase(e)),pending:()=>[...states.values()].some(s=>s.pending)};
})();
