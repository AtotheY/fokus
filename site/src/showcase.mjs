import {pitch} from './search.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArrowDown, ArrowDownToLine, CalendarClock, Check, ChevronDown, LockKeyhole, UsersRound} from 'lucide-react';
const ico=(component,size=16)=>renderToStaticMarkup(React.createElement(component,{size,strokeWidth:1.65,'aria-hidden':true}));
const domains=['reddit.com','x.com','instagram.com'];
const accessPreview=`<div class="summary"><div class="label">${ico(CalendarClock,14)} Working hours</div><h2 id="count">3 sites blocked</h2><p>Session ends at 5:00 PM</p></div><div class="group"><div class="group-name">${ico(ChevronDown,13)} ${ico(UsersRound,17)} <b>Social media</b><small>3 sites</small></div>${domains.map(s=>`<div class="site"><img width="23" height="23" src="/assets/${s}.png" alt=""><span>${s}</span><button class="lock" data-site="${s}" aria-label="Temporarily unblock ${s}">${ico(LockKeyhole,13)}<span>Unblock</span></button></div>`).join('')}</div><div id="pop" hidden role="group" aria-label="Manage site access"></div><div id="message" class="instruction" role="status">Try opening reddit.com for five minutes.</div>`;
const schedulePreview=`<div class="schedule"><b>Working days</b><div class="days">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d,i)=>`<button data-day aria-label="${d}" aria-pressed="${i<5}">${d.slice(0,1)}</button>`).join('')}</div><div class="times"><label>Start<input type="time" id="start" value="09:00" required></label><label>End<input type="time" id="end" value="17:00" required></label></div><button id="save-hours">${ico(Check,14)} Save hours</button><p role="status" id="hours-result">Monday–Friday, 9:00 AM–5:00 PM</p></div>`;
function appWindow(title, body, isDemo = true) {
  return `<div class="studio">
    <div class="bar"><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>${title}</span><small>${isDemo ? 'Interactive preview' : 'Fokus for Mac'}</small>
    </div>${body}
  </div>`;
}
export function home({zip, repository, chess, mines, daily, startingId}){return `<section class="exhibit-hero"><div class="sunset-scene" aria-hidden="true"><span class="sun-disc"></span></div>
  <div class="hero-inner"><div class="hero-title">
    <h1>${pitch.headline[0]} <em>${pitch.headline[1]}</em></h1><p class="pitch">${pitch.body}</p><div class="download-box"><a class="download-main" data-download href="${zip}" download><span>Download Fokus for Mac</span>${ico(ArrowDownToLine,17)}</a><small>Free · Apple Silicon · macOS 12+ <a id="setup-link" href="/download/" aria-label="Mac installation help">Setup</a></small></div></div></div><a class="preview-jump" href="#whats-new">Try a chess puzzle ${ico(ArrowDown,14)}</a></section>
<noscript><style>
.deck-track::after,.deck-nav{display:none}.deck-track .deck-pin{position:static}.deck-cards{gap:30px}
.deck-card[data-depth]{grid-area:auto;transform:none}
</style></noscript>
<section id="whats-new" class="deck-track" aria-label="Puzzle breaks">
  <div class="deck-pin">
    <div class="deck-cards">
      <article class="deck-card chess-card" data-depth="0" aria-labelledby="chess-title">
        <div class="deck-copy"><h2 id="chess-title">Find the winning move.</h2><p>Play a Lichess puzzle from a real game. Pick your move and Fokus plays the reply.</p></div>
        <div id="game-chess" data-start="${startingId}">${chess}</div>
      </article>
      <article class="deck-card mines-card" data-depth="1" aria-labelledby="mines-title">
        <div class="deck-copy"><h2 id="mines-title">Finish this minefield.</h2><p>Two mines are flagged. Use the numbers to find a safe square and pick up where this game left off.</p></div>
        <div id="game-mines">${mines}</div>
      </article>
      <article class="deck-card shelf-card" data-depth="2" aria-labelledby="shelf-title">
        <div class="deck-copy"><h2 id="shelf-title">Your daily puzzle shelf.</h2><p>Open a favorite and check it off when you finish. Your shelf keeps track of what you’ve played today.</p></div>
        <div class="daily-preview" id="daily-preview">${daily}</div>
      </article>
    </div>
    <nav class="deck-nav" aria-label="Puzzle showcase">
      <button data-stop="0" aria-current="step" aria-controls="game-chess">Chess</button>
      <button data-stop="1" aria-controls="game-mines">Minesweeper</button>
      <button data-stop="2" aria-controls="daily-preview">Daily shelf</button>
      <button class="deck-next" aria-label="Continue to Minesweeper"><span>Scroll for more</span> ${ico(ArrowDown,16)}</button>
    </nav>
  </div>
</section>
<div class="features">
  <section id="sample" class="feature-row">
    <div class="feature-copy">
      <h2>Block distracting websites.</h2>
      <p>Choose which sites to block during a focus session. Need a Reddit thread? Unblock Reddit for five minutes while the rest stay blocked. Fokus blocks it again when the timer ends.</p>
    </div>
    ${appWindow('Overview', '<div class="pane">' + accessPreview + '</div>')}
  </section>
  <section class="feature-row feature-reverse" id="blocklists">
    <div class="feature-copy">
      <h2>Block distracting Mac apps.</h2>
      <p>Choose the apps that interrupt your work. If you switch to a blocked app, Fokus hides its window. A Discord call or Steam download can keep running in the background.</p>
    </div>
    ${appWindow('Overview', `<figure class="apps-capture">
      <img width="906" height="288" loading="lazy" src="/assets/mac-apps-active.png" alt="The active Mac apps group in Overview shows Discord and Steam with their Mac icons and a lock beside each app.">
    </figure>`, false)}
  </section>
  <section class="feature-row" id="working-hours">
    <div class="feature-copy">
      <h2>Schedule when blocking starts and stops.</h2>
      <p>Pick your working days and hours. For a nine-to-five workweek, Fokus blocks your selected sites and apps at 9 AM and restores access at 5 PM. Overnight schedules work too.</p>
    </div>
    ${appWindow('Working hours', '<div class="hours-pane">' + schedulePreview + '</div>')}
  </section>
</div>
<div class="source-close"><a class="download-main" data-download href="${zip}" download>Download Fokus for Mac ${ico(ArrowDownToLine,17)}</a><a href="${repository}">Fokus is open source on GitHub ↗</a></div>
<script defer src="/assets/demo.js"></script>
<script type="module" src="/assets/showcase.js"></script>`;
}
