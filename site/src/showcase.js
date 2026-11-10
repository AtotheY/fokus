const one=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
function platform(os){
  const win=os==='windows';
  all('[data-os]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.os===os));
  one('.platforms').classList.toggle('windows',win);
  const action=one('.download-main');action.href=win?'#sample':action.dataset.release;
  action.toggleAttribute('data-download',!win);action.toggleAttribute('download',!win);
  one('#setup-link').hidden=win;
  action.querySelector('span').textContent=win?'Try the web preview':'Download Fokus';
  action.querySelector('svg').style.display=win?'none':'';
  one('#compat').textContent=win?'No Windows download yet.':'Free · Apple Silicon · macOS 12+';
}
all('[data-os]').forEach(b=>b.onclick=()=>platform(b.dataset.os));
const choice=new URLSearchParams(location.search).get('platform');
platform(choice==='windows'||(choice!=='mac'&&/Win/i.test(navigator.platform))?'windows':'mac');
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
  msg.textContent='Saved: '+days+' · '+format(start)+'–'+format(end)+(end<start?' (next day).':'.');
};

const gameButtons = all('[data-game]');
for (const button of gameButtons) {
  button.addEventListener('click', () => {
    for (const option of gameButtons) {
      const selected = option === button;
      option.setAttribute('aria-pressed', String(selected));
      one('#game-' + option.dataset.game).hidden = !selected;
    }
  });
}

const shelfToggle = one('#shelf-toggle');
shelfToggle.addEventListener('click', () => {
  const done = shelfToggle.getAttribute('aria-pressed') === 'false';
  shelfToggle.setAttribute('aria-pressed', String(done));
  shelfToggle.textContent = done ? 'Undo completion' : 'Mark Wordle done';
  one('#shelf-start').hidden = done;
  one('#shelf-done').hidden = !done;
  one('#shelf-count').textContent = done ? '1 of 3 complete' : '0 of 3 complete';
});
