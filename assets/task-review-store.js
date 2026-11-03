/* Owner-scoped cloud reviews, with a tab-local backup for interrupted saves. */
(() => {
 'use strict';
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 function create({db,ownerId,onStatus=()=>{}}){
  const key='advisor-task-review-v1:'+ownerId;
  let active=null,disposed=false,sequence=0,queue=Promise.resolve(),localSafe=false;
  function valid(row){return row?.user_id===ownerId&&uuid(row.id)&&uuid(row.revision)&&typeof row.source_text==='string'&&row.source_text.length<=10000&&Array.isArray(row.tasks)&&row.tasks.length<=30}
  function readLocal(){try{const row=JSON.parse(sessionStorage.getItem(key)||'null');return valid(row)?row:null}catch{return null}}
  function backup(){
   if(!active||disposed)return false;
   try{sessionStorage.setItem(key,JSON.stringify(active));localSafe=true;return true}catch{localSafe=false;return false}
  }
  function adopt(row){if(disposed||!valid(row))return false;active=structuredClone(row);sequence++;backup();return true}
  async function load(){
   const local=readLocal();
   const {data,error}=await db.from('advisor_task_drafts').select('id,user_id,source_text,tasks,revision,created_at').eq('user_id',ownerId).order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(disposed)return null;
   if(error){if(local){adopt(local);onStatus('Черновик восстановлен в этой вкладке. Связь с аккаунтом временно недоступна.');return active}throw Error('Не удалось загрузить сохранённый AI-разбор: '+error.message)}
   const row=local?.dirty&&(!data||local.id===data.id)?local:data;
   if(!row){try{sessionStorage.removeItem(key)}catch{}return null}
   if(!adopt(row))throw Error('Сохранённый AI-разбор имеет неверный формат');
   return structuredClone(active);
  }
  function cache(tasks){
   if(!active||disposed)return false;
   active.tasks=structuredClone(tasks);active.dirty=true;sequence++;
   const safe=backup();onStatus(safe?'Изменения сохранены в этой вкладке. Сохраняю в аккаунт…':'Сохраняю в аккаунт… Не закрывай страницу до подтверждения.');return safe;
  }
  function save(){
   const revisionSequence=sequence,snapshot=active?structuredClone(active):null;
   if(!snapshot||disposed)return Promise.resolve(false);
   const operation=async()=>{
    if(disposed||active?.id!==snapshot.id)return false;
    const expected=active.revision,next=crypto.randomUUID();
    try{
     const {data,error}=await db.from('advisor_task_drafts').update({tasks:snapshot.tasks,revision:next}).eq('id',snapshot.id).eq('user_id',ownerId).eq('revision',expected).select('id,revision').single();
     if(disposed||active?.id!==snapshot.id)return false;
     if(error||data?.id!==snapshot.id||data?.revision!==next)throw Error('Конфликт изменений или ошибка сохранения');
     active.revision=next;
     if(sequence===revisionSequence)active.dirty=false;
     backup();onStatus(active.dirty?'Новые изменения ещё сохраняются…':'AI-разбор и правки сохранены в аккаунте. Можно обновлять страницу.');return true;
    }catch{
     if(!disposed)onStatus(localSafe?'Не удалось сохранить правки в аккаунт. Копия осталась в этой вкладке; обновление страницы её восстановит.':'Сохранить правки не удалось. Не закрывай страницу; скопируй список.');return false;
    }
   };
   queue=queue.then(operation,operation);return queue;
  }
  async function clear(){
   await queue;if(disposed||!active)return false;
   const snapshot=structuredClone(active);
   let data,error;
   try{({data,error}=await db.from('advisor_task_drafts').delete().eq('id',snapshot.id).eq('user_id',ownerId).eq('revision',snapshot.revision).select('id').maybeSingle())}catch{return false}
   if(disposed)return false;
   if(error||data?.id!==snapshot.id)return false;
   active=null;sequence++;try{sessionStorage.removeItem(key)}catch{}return true;
  }
  function dispose(){disposed=true;active=null;try{sessionStorage.removeItem(key)}catch{}}
  return {load,adopt,cache,save,clear,dispose,get unsafe(){return Boolean(active?.dirty)},get active(){return active?structuredClone(active):null}};
 }
 globalThis.AdvisorTaskReviews={create};
})();
