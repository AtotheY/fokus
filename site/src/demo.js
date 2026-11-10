(() => {
  const demo = document.querySelector('#sample');
  const pop = demo.querySelector('#pop');
  const message = demo.querySelector('#message');
  const buttons = [...demo.querySelectorAll('[data-site]')];
  const actions = document.createElement('div');
  actions.className = 'actions';
  message.after(actions);
  const expires = new Map();
  let elapsed = 0;
  let started = Date.now();
  let selected;
  let lastCount = 0;
  const now = () => elapsed + Date.now() - started;
  const clock = ms => {
    const mins = 14*60 + 10 + Math.floor(ms/60000);
    return (Math.floor(mins/60)%12 || 12) + ':' + String(mins%60).padStart(2,'0') + ' PM';
  };
  function close(returnFocus=true) {
    pop.hidden = true;
    if (selected) {
      selected.setAttribute('aria-expanded','false');
      if(returnFocus) selected.focus({preventScroll:true});
    }
    selected = null;
  }
  function action(label, handle) {
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = handle;
    actions.append(button);
  }
  function paint(note) {
    const expired = [];
    for(const [site, until] of expires) if(until<=now()) { expires.delete(site); expired.push(site); }
    const n = buttons.length-expires.size;
    demo.querySelector('#count').textContent=n===0?'No blocks active':n+' site'+(n===1?'':'s')+' blocked';
    for(const b of buttons){
      const site = b.dataset.site, until = expires.get(site);
      b.classList.toggle('open',!!until);
      b.querySelector('span').textContent = until?'Open until '+clock(until):'Unblock';
      b.setAttribute('aria-label',(until?'Manage access to ':'Temporarily unblock ')+site);
    }
    if(expired.length && selected && expired.includes(selected.dataset.site)) close();
    if(note || expired.length) message.textContent=note || expired.join(', ')+' blocked again.';
    if(lastCount !== expires.size || !actions.childElementCount) {
      actions.replaceChildren();
      if(expires.size) action('Skip timer',()=>{
        elapsed = Math.min(...expires.values()); started=Date.now(); close(false);paint();buttons[0].focus({preventScroll:true});
      });
      if(expires.size) action('Reset demo',()=>{expires.clear();elapsed=0;started=Date.now();close(false);paint('All three sites are blocked again.');buttons[0].focus({preventScroll:true})});
    }
    lastCount=expires.size;
  }
  for(const b of buttons) {
    b.setAttribute('aria-expanded','false'); b.setAttribute('aria-controls','pop');
    b.onclick=()=>{
      if(selected===b && !pop.hidden) return close();
      close(false); selected=b; b.setAttribute('aria-expanded','true');
      const site=b.dataset.site, until=expires.get(site);
      pop.innerHTML='<button class="close" aria-label="Close">×</button><b></b><p></p>';
      pop.querySelector('b').textContent=site;
      pop.querySelector('p').textContent=until?'Blocking resumes at '+clock(until):'Unblock temporarily';
      pop.querySelector('.close').onclick=()=>close();
      for(const min of (until?[0]:[1,5,15])) {
        const choose=document.createElement('button');
        choose.dataset.min=min;choose.textContent=min?min+' min':'Block now';
        choose.onclick=()=>{
          if(min) expires.set(site,now()+min*60000); else expires.delete(site);
          close();paint(min?site+' is open for '+min+' min. '+(expires.size===1?'The other two sites stay blocked.':''):site+' is blocked again.');
          if(min) window.fokusEvent?.('demo');
        };
        pop.append(choose);
      }
      pop.hidden=false;pop.querySelector(until?'[data-min="0"]':'[data-min="5"]').focus({preventScroll:true});
    };
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden)close()});
  document.addEventListener('pointerdown',e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest('[data-site]'))close(false)});
  setInterval(()=>paint(),1000);
})();
