(() => {
  const pref='fokus-measure-off';
  const key='fokus-entry-v2';
  sessionStorage.removeItem('fokus-visit');
  const cookie='fokus_download';
  if(document.cookie.includes(cookie+'=')) document.cookie=cookie+'=; Max-Age=0; Path=/; Secure; SameSite=Lax';
  const page=location.pathname;
  const note=document.querySelector('#receipt-note');
  const choice=document.querySelector('#privacy-choice');
  const disabled=()=>navigator.globalPrivacyControl || navigator.doNotTrack==='1' || localStorage.getItem(pref)==='yes';
  if(choice) {
    choice.textContent=disabled()?'Measurement is off':'Turn off site measurement';
    choice.onclick=()=>{
      localStorage.setItem(pref,'yes');sessionStorage.removeItem(key);
      choice.textContent='Measurement is off';
    };
  }
  if(location.search.includes('qa=1')) sessionStorage.setItem('fokus-qa','1');
  if(disabled() || sessionStorage.getItem('fokus-qa') || !['usefokus.dev','localhost','127.0.0.1'].includes(location.hostname)){
    if(note) note.textContent='Measurement is off in this browser.';
    return;
  }
  function referral(){
    const tag=new URLSearchParams(location.search).get('utm_source');
    const host=(tag || (document.referrer && new URL(document.referrer).hostname) || '').toLowerCase();
    if(!host || host===location.hostname)return 'direct/unknown';
    for(const [source,pattern] of Object.entries({chatgpt:/(^|\.)(chatgpt\.com|chat\.openai\.com)$|^chatgpt$/,google:/^(www\.)?google\.[a-z.]+$|^google$/,bing:/(^|\.)bing\.com$|^bing$/,perplexity:/(^|\.)perplexity\.ai$|^perplexity$/,reddit:/(^|\.)reddit\.com$|^reddit$/,claude:/(^|\.)claude\.ai$|^claude$/,github:/(^|\.)github\.com$|^github$/,youtube:/(^|\.)(youtube\.com|youtu\.be)$|^youtube$/,x:/(^|\.)(x\.com|twitter\.com|t\.co)$|^(x|twitter)$/,duckduckgo:/(^|\.)duckduckgo\.com$|^duckduckgo$/,linkedin:/(^|\.)linkedin\.com$|^linkedin$/})){
      if(pattern.test(host))return source;
    }
    return 'other';
  }
  const post=data=>fetch('/api/event',{credentials:'omit',referrerPolicy:'no-referrer',method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true}).then(r=>r.ok).catch(()=>false);
  if(note){
    const receipt=location.hash.slice(1);
    if(!/^[a-f0-9-]{36}$/i.test(receipt))return;
    const share=()=>post({kind:'activation',receipt}).then(ok=>{
      if(ok){history.replaceState(null,'',page);note.textContent='Your website block is working. We’ve counted your setup.';}
      else {note.textContent='We couldn’t save your setup receipt. Reload this page to try again.';}
    });
    share();return;
  }
  let visit;try{visit=JSON.parse(sessionStorage.getItem(key));}catch{}
  const fresh=!visit || Date.now()-visit.last>1800000 ||
    (performance.getEntriesByType('navigation')[0]?.type==='navigate' && (!!(document.referrer && new URL(document.referrer).origin !== location.origin) ||
    new URLSearchParams(location.search).has('utm_source')));
  if(fresh) visit={source:referral()};
  window.fokusEvent=kind=>{
    if(disabled())return;
    visit.last=Date.now();sessionStorage.setItem(key,JSON.stringify(visit));
    return post({kind,source:visit.source,page});
  };
  // Repeat page loads count. An entry is the first page of a tab visit.
  if(fresh)window.fokusEvent('visit');
  window.fokusEvent('view');
  document.addEventListener('click',e=>{
    const a=e.target.closest('a');
    if(!a)return;
    if(a.hasAttribute('data-download')&&!disabled()){
      if(a.matches('.download-main'))window.fokusEvent('cta');
      window.fokusEvent('download');
    } else if(a.pathname==='/download/' && a.origin===location.origin)window.fokusEvent('cta');
  });
})();
