import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'https://ablaiskiy5.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const areas=['work','personal','study','health','sport','projects','other'];
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'POST only'},405);
 if(req.headers.get('origin')&&req.headers.get('origin')!=='https://ablaiskiy5.github.io')return json({error:'Invalid origin'},403);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return json({error:'Необходимо войти в аккаунт'},401);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),key=Deno.env.get('OPENAI_API_KEY');
 if(!url||!anon||!key)return json({error:'AI временно недоступен'},503);
 const db=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}}});
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!service)return json({error:'Сервер временно недоступен'},503);
 const admin=createClient(url,service);

 const {data:who,error:authErr}=await db.auth.getUser(token);
 if(authErr||!who?.user)return json({error:'Недостаточно прав'},401);
 if(!who.user.email_confirmed_at)return json({error:'Подтверди email перед использованием AI.'},403);
 const {data:pilotAllowed,error:pilotErr}=await admin.rpc('advisor_ai_is_allowed_email',{p_email:who.user.email||''});
 if(pilotErr){console.error('Pilot task access check failed',JSON.stringify({code:pilotErr.code||''}));return json({error:'Не удалось проверить AI-доступ.'},503)}
 if(pilotAllowed!==true)return json({error:'Подтверди email или проверь доступ к аккаунту.'},403);
 let input;try{input=await req.json()}catch{return json({error:'Неверный запрос'},400)}
 const text=String(input?.text||'').trim();
 if(text.length<3||text.length>10000)return json({error:'Введи от 3 до 10 000 символов'},400);
 const {data:reservation,error:reserveErr}=await admin.rpc('reserve_advisor_task_ai_request',{p_user_id:who.user.id});
 if(reserveErr){console.error('Task quota reservation failed',JSON.stringify({code:reserveErr.code||''}));return json({error:'Не удалось проверить лимит AI'},503)}
 if(reservation==='user_limit')return json({error:'На сегодня доступно не более 12 AI-разборов. Карточки можно добавлять вручную.'},429);
 if(reservation==='global_limit')return json({error:'Общий лимит AI-разборов на сегодня исчерпан. Повтори позже.'},429);
 if(reservation!=='ok')return json({error:'Подтверди email или проверь доступ к аккаунту.'},403);
 const model=Deno.env.get('OPENAI_MODEL')||'gpt-5-mini';
 const today=new Date(Date.now()+5*3600*1000).toISOString().slice(0,10);
 const prompt='Ты организатор дел. Преврати хаотичную запись в отдельные конкретные исполнимые задачи, максимум 30. Формулируй кратко и без повторов. Категории: work работа и клиенты; personal личное и семья; study учёба и экзамены; health медицина; sport спорт; projects сторонние проекты; other прочее. priority: high, normal, low. Дату due_date YYYY-MM-DD назначай ТОЛЬКО если она однозначно названа пользователем; выражения завтра и сегодня можно вычислить относительно локальной даты Казахстана '+today+' (время города Алматы, UTC+5). Для неопределённых сроков оставь пустую строку. Не выдумывай поручения, даты и обязательства. Не составляй советы, только JSON. Поле description заполняй лишь деталями из сообщения.';
 const schema={type:'object',additionalProperties:false,required:['tasks'],properties:{tasks:{type:'array',maxItems:30,items:{type:'object',additionalProperties:false,required:['title','area','priority','due_date','description'],properties:{title:{type:'string'},area:{type:'string',enum:areas},priority:{type:'string',enum:['high','normal','low']},due_date:{type:'string'},description:{type:'string'}}}}}};
 let response;try{response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:prompt,input:text,reasoning:{effort:'low'},max_output_tokens:3000,text:{format:{type:'json_schema',name:'task_batch',strict:true,schema}},store:false})})}catch{return json({error:'AI не отвечает'},502)}
 let payload={};try{payload=await response.json()}catch{}
 if(!response.ok){console.error('Task organizer failure',JSON.stringify({status:response.status,code:payload.error?.code||''}));return json({error:'Ошибка организации задач, попробуй ещё раз'},502)}
 const output=(payload.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 let tasks;try{tasks=JSON.parse(output).tasks}catch{return json({error:'AI не смог вернуть структурированный список. Попробуй разбить текст на части.'},502)}
 if(!Array.isArray(tasks))return json({error:'Некорректный ответ AI'},502);
 tasks=tasks.slice(0,30).filter(x=>x&&typeof x.title==='string'&&x.title.trim()).map(x=>({title:x.title.trim().slice(0,220),area:areas.includes(x.area)?x.area:'other',priority:['high','normal','low'].includes(x.priority)?x.priority:'normal',due_date:/^\d{4}-\d{2}-\d{2}$/.test(x.due_date||'')?x.due_date:null,description:String(x.description||'').slice(0,3000)}));
 return json({tasks});
});
