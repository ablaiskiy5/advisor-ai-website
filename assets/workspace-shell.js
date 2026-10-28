/* Shared navigation for the existing static Workspace. No account data is stored here. */
(() => {
 'use strict';
 const sections=[['home','⌂','Главная'],['assistant','✦','AI Ассистент'],['portfolio','▤','Портфели'],['ideas','✧','Инвестиционные идеи'],['markets','◉','Рынки и макро'],['academy','◈','Академия'],['tasks','☑','Задачи и рутина'],['documents','▧','Документы'],['history','◷','История и сохранённое'],['settings','⚙','Настройки и профиль']];
 const file=location.pathname.split('/').pop();
 const inWorkspace=file==='workspace.html';
 const routeDefaults={'ai-chat.html':'assistant','tasks-board.html':'tasks','portfolio-report.html':'portfolio','bond-analysis.html':'portfolio','ideas-risk-budget.html':'ideas','tools-health.html':'settings'};
 const root=document.createElement('div');root.id='workspace-shell';
 const link=(key,icon,label)=>`<a href="${key==='tasks'?'./tasks-board.html':'./workspace.html#'+key}" data-section="${key}" title="${label}"><span class="shell-icon" aria-hidden="true">${icon}</span><span class="shell-label">${label}</span></a>`;
 root.innerHTML='<a class="shell-skip" href="#workspace-main">К содержимому</a><div class="shell-mobile"><a href="./workspace.html#home">Advisor <strong>AI</strong></a><button type="button" id="shell-menu" aria-controls="shell-sidebar" aria-expanded="false">☰ Разделы</button></div><button type="button" id="shell-backdrop" tabindex="-1" aria-label="Закрыть меню" hidden></button><aside id="shell-sidebar" aria-label="Разделы Workspace"><a class="shell-brand" href="./workspace.html#home" title="Advisor AI · Главная"><span class="shell-monogram">A<span>i</span></span><span class="shell-label">Advisor <b>AI</b><small>WORKSPACE</small></span></a><nav aria-label="Главное меню">'+sections.map(s=>link(...s)).join('')+'</nav><div class="shell-footer"><a href="./" class="shell-site">↗ <span class="shell-label">О платформе</span></a><button type="button" id="shell-collapse" aria-expanded="true" aria-controls="shell-sidebar" title="Свернуть меню">⇤ <span class="shell-label">Свернуть меню</span></button></div></aside>';
 document.body.prepend(root);
 const main=document.querySelector('main');if(main){if(!main.id)main.id='workspace-main';root.querySelector('.shell-skip').href='#'+main.id;main.setAttribute('tabindex','-1')}
 const menu=document.getElementById('shell-menu'),sidebar=document.getElementById('shell-sidebar'),backdrop=document.getElementById('shell-backdrop'),collapse=document.getElementById('shell-collapse');
 const mobile=matchMedia('(max-width: 900px)');let expanded=false;
 const setActive=key=>root.querySelectorAll('[data-section]').forEach(a=>{if(a.dataset.section===key)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 function setOpen(open,restoreFocus=false){expanded=open;document.body.classList.toggle('shell-menu-open',open&&mobile.matches);root.classList.toggle('shell-open',open);menu.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;if(main)main.inert=open&&mobile.matches;if(open)sidebar.querySelector('[aria-current="page"]')?.focus();else if(restoreFocus)menu.focus()}
 function setCollapsed(value){document.body.classList.toggle('shell-collapsed',value);collapse.setAttribute('aria-expanded',String(!value));collapse.title=value?'Развернуть меню':'Свернуть меню';collapse.innerHTML=(value?'⇥':'⇤')+' <span class="shell-label">'+collapse.title+'</span>'}
 try{setCollapsed(localStorage.getItem('advisor-shell-collapsed')==='1')}catch{}
 collapse.onclick=()=>{const value=!document.body.classList.contains('shell-collapsed');setCollapsed(value);try{localStorage.setItem('advisor-shell-collapsed',value?'1':'0')}catch{}};
 menu.onclick=()=>setOpen(!expanded,true);backdrop.onclick=()=>setOpen(false,true);
 root.addEventListener('keydown',event=>{if(!expanded)return;if(event.key==='Escape'){event.preventDefault();setOpen(false,true)}if(event.key==='Tab'){const nodes=[menu,...sidebar.querySelectorAll('a,button')].filter(n=>n.getClientRects().length);const index=nodes.indexOf(document.activeElement);if(event.shiftKey&&index<=0){event.preventDefault();nodes.at(-1).focus()}else if(!event.shiftKey&&index===nodes.length-1){event.preventDefault();nodes[0].focus()}}});
 mobile.addEventListener('change',()=>setOpen(false));
 root.addEventListener('click',event=>{const a=event.target.closest('a[data-section]');if(!a||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(inWorkspace&&a.dataset.section!=='tasks'&&typeof window.navigateWorkspace==='function'){event.preventDefault();if(window.navigateWorkspace(a.dataset.section)!==false){setOpen(false);main?.focus()}}});
 window.AdvisorShell={setActive};
 setActive(window.workspaceCurrentSection?.()||routeDefaults[file]||'home');
 document.body.classList.add('has-workspace-shell');
})();
