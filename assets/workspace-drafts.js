/* Tab-local, owner-scoped text drafts. Never persist passwords, tokens or file bytes. */
(() => {
 'use strict';
 const prefix='advisor-input-draft-v1:',ttl=12*60*60*1000;
 const memory=new Map();let bound=null;
 const key=(owner,scope)=>prefix+encodeURIComponent(owner)+':'+encodeURIComponent(scope);
 function remove(k){memory.delete(k);try{sessionStorage.removeItem(k)}catch{}}
 function read(k,owner,scope){try{const raw=memory.get(k)||sessionStorage.getItem(k);if(!raw)return null;const data=JSON.parse(raw);if(data.owner!==owner||data.scope!==scope||!Number.isFinite(data.time)||Date.now()-data.time>ttl||data.time>Date.now()+60000||!data.fields||typeof data.fields!=='object'){remove(k);return null}return data.fields}catch{remove(k);return null}}
 function capture(){
  if(!bound)return true;
  const fields={};for(const [id,baseline] of Object.entries(bound.baseline)){const el=document.getElementById(id);if(el&&el.value!==baseline)fields[id]=el.value}
  const k=key(bound.owner,bound.scope);
  if(!Object.keys(fields).length){remove(k);return true}
  const raw=JSON.stringify({owner:bound.owner,scope:bound.scope,time:Date.now(),fields});
  // Refuse overflow, never silently truncate an investment or task draft.
  memory.set(k,raw);
  if(raw.length>250000){bound.saved=false;return false}
  try{sessionStorage.setItem(k,raw);bound.saved=true;return true}catch{bound.saved=false;return false}
 }
 function bind(owner,scope,ids){
  bound=null;if(!owner||!scope)return;
  const baseline={};for(const id of ids){const el=document.getElementById(id);if(el&&el.type!=='password'&&el.type!=='file')baseline[id]=el.value}
  bound={owner,scope,baseline,saved:true};
  const fields=read(key(owner,scope),owner,scope);if(!fields)return;
  let restored=false;for(const id of Object.keys(baseline)){const el=document.getElementById(id);if(typeof fields[id]==='string'){el.value=fields[id];restored=true}}
  if(restored){const first=document.getElementById(Object.keys(baseline)[0]);if(first){const note=document.createElement('p');note.className='draft-restored-note';note.setAttribute('role','status');note.textContent='Черновик восстановлен в этой вкладке. В аккаунт он попадёт после отправки или сохранения.';const composer=first.closest?.('.composer');(composer||first).insertAdjacentElement(composer?'beforebegin':'afterend',note)}}
 }
 function acknowledge(ids,savedValues=null){if(!bound)return;for(const id of ids){const el=document.getElementById(id);if(el&&Object.hasOwn(bound.baseline,id))bound.baseline[id]=savedValues&&Object.hasOwn(savedValues,id)?savedValues[id]:el.value}capture()}
 function purge(){bound=null;memory.clear();try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(prefix))sessionStorage.removeItem(k)}}catch{}}
 function dirty(){return !!bound&&Object.entries(bound.baseline).some(([id,value])=>document.getElementById(id)?.value!==value)}
 document.addEventListener('input',e=>{if(bound&&Object.hasOwn(bound.baseline,e.target.id))capture()});
 document.addEventListener('change',e=>{if(bound&&Object.hasOwn(bound.baseline,e.target.id))capture()});
 window.addEventListener('pagehide',capture);
 window.addEventListener('beforeunload',e=>{const saved=capture();if((dirty()&&!saved)||window.workspaceHasTransientWork?.()){e.preventDefault();e.returnValue=''}});
 window.AdvisorDrafts={bind,capture,acknowledge,purge};
})();
