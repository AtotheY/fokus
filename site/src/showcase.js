const one=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
const dayBtns=all('[data-day]');
dayBtns.forEach(b=>b.onclick=()=>b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')!=='true'));
const format=t=>new Date('2000-01-01T'+t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
one('#save-hours').onclick=()=>{
  const selected=dayBtns.filter(b=>b.getAttribute('aria-pressed')==='true');
  const start=one('#start').value,end=one('#end').value;
  const msg=one('#hours-result');
  if(!selected.length){msg.textContent='Choose at least one working day.';return;}
  if(!start||!end||end===start){msg.textContent='Choose two different times.';return;}
  const days=selected.length===7?'Every day':selected.map(b=>b.getAttribute('aria-label').slice(0,3)).join(', ');
  msg.textContent='Your hours are set for '+days+' · '+format(start)+'–'+format(end)+(end<start?' (next day).':'.');
};

// Load the app's games as the visitor approaches the puzzle section.
const puzzleSection = one('#whats-new');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      import('./puzzle-preview.js');
    }
  }, {rootMargin: '300px'});
  observer.observe(puzzleSection);
} else {
  import('./puzzle-preview.js');
}
