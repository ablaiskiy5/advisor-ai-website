'use strict';
// Shared safe rendering for AI replies; no model HTML is inserted.
function safeCitedUrl(raw){
 // Model output is untrusted: only real HTTPS URLs become interactive source links.
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)return '';
  return url.href;
 }catch{return ''}
}
function renderInlineSafe(node,value){
 const parts=String(value).split(/(\*\*[^*\n]+\*\*|\[[^\]\n]{1,120}\]\(https:\/\/[^\s)\n]{1,2048}\)|`[^`\n]+`)/g);
 for(const part of parts){let el=null;
  if(part.startsWith('**')&&part.endsWith('**')&&part.length>4){el=document.createElement('strong');el.textContent=part.slice(2,-2)}
  else if(part.startsWith('`')&&part.endsWith('`')&&part.length>2){el=document.createElement('code');el.textContent=part.slice(1,-1)}
  else{
   const match=/^\[([^\]\n]{1,120})\]\((https:\/\/[^\s)\n]{1,2048})\)$/.exec(part);
   const url=match?safeCitedUrl(match[2]):'';
   if(url){
    el=document.createElement('a');el.href=url;el.target='_blank';el.rel='noopener noreferrer';el.textContent=match[1];
   }
  }
  if(el)node.append(el);else node.append(document.createTextNode(part));
 }
}
function renderAnswerSafe(root,message){
 const lines=String(message||'').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i],t=line.trim();if(!t)continue;
  if(t.startsWith('|')&&t.endsWith('|')&&i+1<lines.length&&/^\s*\|?[-:| ]+\|?\s*$/.test(lines[i+1])){
   const wrap=document.createElement('div');wrap.className='table-scroll';
   const table=document.createElement('table');let header=true;
   while(i<lines.length&&lines[i].trim().startsWith('|')&&lines[i].trim().endsWith('|')){
    const cells=lines[i++].trim().slice(1,-1);
    if(/^[-:| ]+$/.test(cells))continue;
    const row=document.createElement('tr');
    for(const val of cells.split('|')){const td=document.createElement(header?'th':'td');renderInlineSafe(td,val.trim());row.append(td)}
    table.append(row);header=false;
   }i--;wrap.append(table);root.append(wrap);continue;
  }
  const heading=/^(#{1,4})\s+(.+)$/.exec(t);
  if(heading){const el=document.createElement(heading[1].length<3?'h2':'h3');renderInlineSafe(el,heading[2]);root.append(el);continue}
  const bullet=/^([-*•]\s+|\d+[.)]\s+)(.+)$/.exec(t);
  if(bullet){
   const type=/^\d/.test(t)?'ol':'ul',prev=root.lastElementChild;
   const list=prev?.classList?.contains('answer-list')&&prev.tagName.toLowerCase()===type?prev:document.createElement(type);
   if(list!==prev){list.className='answer-list';root.append(list)}
   const item=document.createElement('li');renderInlineSafe(item,bullet[2]);list.append(item);continue;
  }
  if(/^>\s?/.test(t)){const quote=document.createElement('blockquote');renderInlineSafe(quote,t.replace(/^>\s?/,''));root.append(quote);continue}
  const el=document.createElement('p');renderInlineSafe(el,line);root.append(el);
 }
}
