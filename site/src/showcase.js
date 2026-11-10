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

// The sticky stage occupies ordinary document scroll. Each stop changes only
// which mounted card is in front, so moves and shelf checks survive a round trip.
const pin = puzzleSection.querySelector('.deck-pin');
const cards = all('.deck-card');
const stops = all('[data-stop]');
const advance = pin.querySelector('.deck-next');
let active = -1;
let pinTop = 0;
let frame = 0;

function activate(index) {
  if (active === index) return;
  const previous = active;
  active = index;
  cards.forEach((card, i) => {
    const behind = i !== index;
    if (behind && card.contains(document.activeElement)) stops[index].focus({preventScroll: true});
    card.inert = behind;
    card.dataset.depth = (i - index + cards.length) % cards.length;
    card.classList.toggle('is-leaving', i === previous);
    if (behind) stops[i].removeAttribute('aria-current');
    else stops[i].setAttribute('aria-current', 'step');
  });
  const last = index === cards.length - 1;
  advance.querySelector('span').textContent = last ? 'Continue' : 'Scroll for more';
  advance.setAttribute('aria-label', 'Continue to ' + (last ? 'website blocking' : stops[index + 1].textContent));
}
for (const card of cards) card.addEventListener('animationend', () => card.classList.remove('is-leaving'));

function travel() { return puzzleSection.clientHeight - pin.offsetHeight; }
function update() {
  frame = 0;
  const progress = (pinTop - puzzleSection.getBoundingClientRect().top) / Math.max(1, travel());
  activate(Math.max(0, Math.min(cards.length - 1, Math.floor(progress * cards.length))));
}
function schedule() { if (!frame) frame = requestAnimationFrame(update); }
function measure() {
  const available = innerHeight - pin.offsetHeight;
  pinTop = available < 0 ? available : Math.round(available / 2);
  pin.style.setProperty('--pin-top', pinTop + 'px');
  update();
}
function jump(index) {
  const start = scrollY + puzzleSection.getBoundingClientRect().top - pinTop;
  window.scrollTo({top: start + travel() * (index + .2) / cards.length, behavior: 'instant'});
  activate(index);
}
stops.forEach((button, index) => button.addEventListener('click', () => jump(index)));
advance.addEventListener('click', () => {
  if (active < cards.length - 1) jump(active + 1);
  else {
    const blocking = document.querySelector('#sample');
    blocking.scrollIntoView({behavior: 'instant'});
    const heading = blocking.querySelector('h2');
    heading.tabIndex = -1;
    heading.focus({preventScroll: true});
  }
});
function followHash() {
  const target = document.getElementById(location.hash.slice(1));
  const index = cards.findIndex(card => card.contains(target));
  if (index >= 0) jump(index);
}
window.addEventListener('scroll', schedule, {passive: true});
window.addEventListener('resize', measure);
window.addEventListener('hashchange', followHash);
new ResizeObserver(measure).observe(pin);
measure();
followHash();
