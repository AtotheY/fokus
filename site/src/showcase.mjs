import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArrowDown, ArrowDownToLine, CalendarClock, Check, ChevronDown, Laptop, LockKeyhole, UsersRound} from 'lucide-react';
const ico=(component,size=16)=>renderToStaticMarkup(React.createElement(component,{size,strokeWidth:1.65,'aria-hidden':true}));
const domains=['reddit.com','x.com','instagram.com'];
const windows='<svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M1 1h7v7H1zm9 0h7v7h-7zM1 10h7v7H1zm9 0h7v7h-7z"/></svg>';
const accessPreview=`<div class="summary"><div class="label">${ico(CalendarClock,14)} Working hours</div><h2 id="count">3 sites blocked</h2><p>Session ends at 5:00 PM</p></div><div class="group"><div class="group-name">${ico(ChevronDown,13)} ${ico(UsersRound,17)} <b>Social media</b><small>3 sites</small></div>${domains.map(s=>`<div class="site"><img width="23" height="23" src="/assets/${s}.png" alt=""><span>${s}</span><button class="lock" data-site="${s}" aria-label="Temporarily unblock ${s}">${ico(LockKeyhole,13)}<span>Unblock</span></button></div>`).join('')}</div><div id="pop" hidden role="group" aria-label="Manage site access"></div><div id="message" class="instruction" role="status">Choose Unblock next to reddit.com.</div>`;
const schedulePreview=`<div class="schedule"><b>Working days</b><div class="days">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d,i)=>`<button data-day aria-label="${d}" aria-pressed="${i<5}">${d.slice(0,1)}</button>`).join('')}</div><div class="times"><label>Start<input type="time" id="start" value="09:00" required></label><label>End<input type="time" id="end" value="17:00" required></label></div><button id="save-hours">${ico(Check,14)} Save hours</button><p role="status" id="hours-result">Monday–Friday, 9:00 AM–5:00 PM</p></div>`;
function appWindow(title, body, isDemo = true) {
  return `<div class="studio">
    <div class="bar"><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>${title}</span><small>${isDemo ? 'Interactive preview' : 'Fokus for Mac'}</small>
    </div>${body}
  </div>`;
}
export function home({zip, repository}){return `<section class="exhibit-hero"><div class="sunset-scene" aria-hidden="true"><span class="sun-disc"></span></div>
  <div class="hero-inner"><div class="hero-title">
    <h1>Skip the doomscroll <em>between prompts.</em></h1><p class="pitch">Fokus blocks distracting sites and apps on your Mac.</p><div class="download-box"><div class="platforms" role="group" aria-label="Operating system"><i></i><button aria-pressed="true" data-os="mac">${ico(Laptop,18)} macOS</button><button aria-pressed="false" data-os="windows">${windows} Windows</button></div><a class="download-main" data-download data-release="${zip}" href="${zip}" download><span>Download Fokus</span>${ico(ArrowDownToLine,17)}</a><small><span id="compat" aria-live="polite">Free · Apple Silicon · macOS 12+</span> <a id="setup-link" href="/download/" aria-label="Mac installation help">Setup</a></small></div></div></div><a class="preview-jump" href="#sample">Try a site break ${ico(ArrowDown,14)}</a></section>
<div class="features">
  <section id="sample" class="feature-row">
    <div class="feature-copy">
      <h2>Look up a fix without lifting every block.</h2>
      <p>Give Reddit five minutes to check an error message. X and Instagram stay blocked, and Fokus blocks Reddit again when time runs out.</p>
    </div>
    ${appWindow('Overview', '<div class="pane">' + accessPreview + '</div>')}
  </section>
  <section class="feature-row feature-reverse" id="blocklists">
    <div class="feature-copy">
      <h2>Keep Discord and Steam out of the way.</h2>
      <p>Choose the Mac apps that pull you out of your editor. If you switch to Discord during a focus session, Fokus hides its window while your voice call keeps running.</p>
    </div>
    ${appWindow('Overview', `<figure class="apps-capture">
      <img width="906" height="288" loading="lazy" src="/assets/mac-apps-active.png" alt="The active Mac apps group in Overview shows Discord and Steam with their Mac icons and a lock beside each app.">
    </figure>`, false)}
  </section>
  <section class="feature-row" id="working-hours">
    <div class="feature-copy">
      <h2>Start the block with your workday.</h2>
      <p>Set a weekday block from nine to five and Fokus repeats it for you. For a late coding session, choose an end time after midnight.</p>
    </div>
    ${appWindow('Working hours', '<div class="hours-pane">' + schedulePreview + '</div>')}
  </section>
</div>
<section id="whats-new" class="release-section" aria-labelledby="release-title">
  <div class="release-inner">
    <h2 id="release-title">What’s new in Fokus</h2>
    <div class="release-grid">
      <article class="release-feature">
        <h3>Games you can leave mid-move.</h3>
        <p>Play Word Search or Minesweeper while your agent works. When the diff is ready, switch back to your editor. Your board saves after every move.</p>
        <div class="release-preview">
          <div class="release-controls" role="group" aria-label="Game preview">
            <button type="button" data-game="words" aria-pressed="true">Word Search</button>
            <button type="button" data-game="mines" aria-pressed="false">Minesweeper</button>
          </div>
          <div class="puzzle-still">
            <img id="game-words" width="736" height="1160" loading="lazy" src="/assets/built-in-words.png" alt="Word Search in Fokus with two words highlighted on the board and crossed off the list.">
            <img id="game-mines" width="736" height="1052" hidden loading="lazy" src="/assets/built-in-mines.png" alt="A saved Minesweeper board with revealed squares and one flagged mine.">
          </div>
        </div>
      </article>
      <article class="release-feature">
        <h3>Your daily puzzle tracker.</h3>
        <p>Keep Wordle, Connections, and your own daily links on one shelf. Check off a puzzle to see what’s next and keep your daily streak.</p>
        <div class="release-preview">
          <div class="release-controls">
            <button id="shelf-toggle" type="button" aria-pressed="false">Mark Wordle done</button>
            <span id="shelf-count" role="status">0 of 3 complete</span>
          </div>
          <div class="shelf-still">
            <img id="shelf-start" width="906" height="942" loading="lazy" src="/assets/daily-shelf-start.png" alt="Daily shelf with Wordle up next and a two-day streak from earlier puzzles.">
            <img id="shelf-done" width="906" height="942" hidden loading="lazy" src="/assets/daily-shelf-done.png" alt="Daily shelf with Wordle checked off, Connections up next, and a three-day streak.">
          </div>
        </div>
      </article>
    </div>
  </div>
</section>
<div class="source-close"><a href="${repository}">View the source on GitHub ↗</a></div>
<script defer src="/assets/demo.js"></script>
<script type="module" src="/assets/showcase.js"></script>`;
}
