const dashboard=document.querySelector('[data-learning-dashboard]');
if(dashboard){
  const folderGrid=dashboard.querySelector('[data-folder-grid]');
  const sections=[...dashboard.querySelectorAll('[data-folder-section]')];
  const byId=new Map(sections.map(section=>[section.id,section]));
  const breadcrumb=dashboard.querySelector('[data-folder-breadcrumb]');
  const current=dashboard.querySelector('[data-current-folder]');
  const search=dashboard.querySelector('#lesson-search');
  const searchPanel=dashboard.querySelector('[data-search-results]');
  const searchGrid=dashboard.querySelector('[data-search-grid]');
  const noResults=dashboard.querySelector('[data-no-results]');
  const clear=dashboard.querySelector('[data-clear-search]');
  const status=dashboard.querySelector('[data-dashboard-status]');
  const lessons=[...dashboard.querySelectorAll('[data-lesson]')];
  const normalize=value=>value.toLocaleLowerCase().replace(/[\u2010-\u2015-]/g,' ').replace(/\s+/g,' ').trim();
  let activeFolder=null;

  function folderFromLocation(){
    let hash='';
    try{hash=decodeURIComponent(location.hash.slice(1));}catch{return null;}
    if(hash==='worked-case-title')hash='case-studies';
    return byId.has(hash)?hash:null;
  }
  function show({focus=false}={}){
    const query=normalize(search.value);
    sections.forEach(section=>{section.hidden=true;});
    folderGrid.hidden=Boolean(query||activeFolder);
    searchPanel.hidden=!query;
    breadcrumb.hidden=!query&&!activeFolder;
    clear.hidden=!query;
    if(query){
      const terms=query.split(' ');
      const matches=lessons.filter(lesson=>{
        const text=normalize(lesson.dataset.search);
        return terms.every(term=>text.includes(term));
      });
      searchGrid.replaceChildren(...matches.map(lesson=>lesson.cloneNode(true)));
      noResults.hidden=matches.length!==0;
      current.textContent='Search results';
      status.textContent=`${matches.length} ${matches.length===1?'result':'results'} found across all folders.`;
    }else if(activeFolder){
      const section=byId.get(activeFolder);
      section.hidden=false;
      current.textContent=section.dataset.folderName;
      const count=section.querySelectorAll('[data-lesson]').length;
      const kind=section.dataset.entryKind||'lesson';
      const label=count===1?kind:kind==='case study'?'case studies':`${kind}s`;
      status.textContent=`${count} ${label} in this folder.`;
      if(focus)section.querySelector('h2').focus({preventScroll:true});
    }else{
      current.textContent='';
      status.textContent='';
      if(focus)dashboard.querySelector('[data-library-heading]').focus({preventScroll:true});
    }
  }
  function navigate(id){
    activeFolder=id;
    search.value='';
    const next=new URL(location.href);
    next.hash=id||'';
    if(next.href!==location.href)history.pushState(null,'',next.href);
    show({focus:true});
  }
  for(const folder of dashboard.querySelectorAll('[data-open-folder]')){
    folder.addEventListener('click',event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      navigate(folder.dataset.openFolder);
    });
  }
  dashboard.querySelector('[data-all-folders]').addEventListener('click',()=>navigate(null));
  search.addEventListener('input',()=>show());
  search.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&search.value){search.value='';show();}
  });
  clear.addEventListener('click',()=>{search.value='';show();search.focus();});
  const restore=()=>{activeFolder=folderFromLocation();search.value='';show();};
  window.addEventListener('popstate',restore);
  window.addEventListener('hashchange',restore);
  dashboard.querySelector('[data-search-controls]').hidden=false;
  activeFolder=folderFromLocation();
  show();
  dashboard.dataset.dashboardReady='true';
}
