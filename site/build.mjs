import fs from 'node:fs';
import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {repository, releases, latest, macDownload, checksums} from './src/release.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArrowDownToLine, ArrowRight, ArrowUpRight, Aperture, UsersRound, LockKeyhole, CalendarClock, Clock3, Gamepad2, ChevronDown, Monitor} from 'lucide-react';
import {home as showcase} from './src/showcase.mjs';
import {guides} from './src/guides.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
const base = 'https://usefokus.dev';
const date = '2026-11-09';
const assets = path.join(out, 'assets');
fs.rmSync(out, {recursive:true, force:true});
fs.mkdirSync(assets,{recursive:true});
for(const file of [...fs.readdirSync(path.join(root,'../public/icons')).map(n=>'icons/'+n),'horizon.jpg','sky.webp','ridges.webp','site-icons/reddit.com.png','site-icons/instagram.com.png','site-icons/x.com.png']){
  fs.copyFileSync(path.join(root,'../public',file),path.join(assets,path.basename(file)));
}
fs.cpSync(path.join(root, '../public/chess'), path.join(out, 'chess'), {recursive: true});
for(const name of fs.readdirSync(path.join(root,'proof'))) fs.copyFileSync(path.join(root,'proof',name),path.join(assets,name));
for(const file of ['site.css','showcase.css','showcase.js','demo.js','measure.js']) fs.copyFileSync(path.join(root,'src',file),path.join(assets,file));
await build({
  entryPoints: [path.join(root, 'src/mount-previews.jsx')],
  bundle: true,
  minify: true,
  jsx: 'automatic',
  format: 'esm',
  outfile: path.join(assets, 'puzzle-preview.js')
});
// Render the same controls and shelf geometry that visitors will interact with.
const serverBundle = path.join(out, '.build/render-previews.mjs');
await build({
  entryPoints: [path.join(root, 'src/render-previews.jsx')],
  outfile: serverBundle,
  platform: 'node',
  format: 'esm',
  bundle: true,
  packages: 'external',
  jsx: 'automatic',
  plugins: [{
    name: 'static-markup',
    setup(build) {
      build.onResolve({filter: /\.css$/}, args => ({path: args.path, namespace: 'style'}));
      build.onLoad({filter: /.*/, namespace: 'style'}, () => ({contents: '', loader: 'js'}));
    }
  }]
});
const {previews} = await import(pathToFileURL(serverBundle));
fs.rmSync(path.dirname(serverBundle), {recursive: true});
const esc = text => text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const icon = (name,size=18)=>renderToStaticMarkup(React.createElement(name,{size,'aria-hidden':true,'strokeWidth':1.65}));
const brand = '<a class="brand" href="/"><img width="40" height="40" src="/assets/ceramic.png" alt="">Fokus</a>';
const cta = '<a class="cta" href="/download/">'+icon(ArrowDownToLine)+'Get Fokus for Mac</a>';
const guideUrl = g=>'/guides/'+g.slug+'/';
const arrow = icon(ArrowRight);
const pageRecords=[];
function save(file,content){fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});fs.writeFileSync(path.join(out,file),content)}
function page(url,title,desc,body,{article=null,hidden=false,home=false}={}){
  const tags=article?{'@context':'https://schema.org','@type':'TechArticle',headline:title,description:desc,datePublished:article.date,dateModified:article.date,author:{'@type':'Organization',name:'Fokus'},mainEntityOfPage:base+url}:null;
  save(url==='404'?'404.html':url.slice(1)+'index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Fokus</title><meta name="description" content="${esc(desc)}">${hidden?'<meta name="robots" content="noindex">':'<link rel="canonical" href="'+base+url+'">'}<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${base}/assets/ceramic.png"><link rel="icon" href="/assets/ceramic.png"><link rel="stylesheet" href="/assets/site.css">${home?'<link rel="stylesheet" href="/assets/showcase.css"><link rel="stylesheet" href="/assets/puzzle-preview.css">':''}<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Fokus guides">${tags?'<script type="application/ld+json">'+JSON.stringify(tags)+'</script>':''}<script defer src="/assets/measure.js"></script></head><body class="${home?'home':''}"><a class="skip" href="#main">Skip to content</a><header class="nav"><div>${brand}<nav aria-label="Main"><a href="/#whats-new">Puzzle breaks</a><a href="/#sample">Blocking</a><a href="${repository}">GitHub ↗</a></nav></div></header><main id="main">${body}</main><footer>${brand}<div class="footer-links"><a href="${repository}">GitHub ↗</a><a href="${releases}">Release notes</a></div><a href="/privacy/">Privacy</a></footer></body></html>`);
  if(!hidden)pageRecords.push([url,article?.date??date]);
}
const guideIcons = {
  'what-to-do-while-your-coding-agent-runs': Gamepad2,
  'block-websites-during-working-hours': CalendarClock
};
const siteBreakGuide = guides.find(guide => guide.slug === 'temporarily-unblock-one-website');
function cards(){return guides.map(g=>`<a class="guide-row" href="${guideUrl(g)}"><span class="glyph">${icon(guideIcons[g.slug] ?? Clock3,22)}</span><span>${g.short}</span>${icon(ArrowUpRight,17)}</a>`).join('')}
page('/','Puzzle breaks while your coding agent works','Trade doomscrolling between prompts for a Lichess chess puzzle. Fokus saves your progress, tracks your dailies and blocks distracting sites and apps on your Mac.',showcase({zip:macDownload, repository, ...previews}),{home:true});
page('/guides/','Puzzle breaks and website blocking on Mac','Follow tested examples for taking a puzzle break, opening one blocked site or setting your Mac’s working hours.',`<div class="article"><h1>Fokus guides</h1><p class="intro">Take a puzzle break, look up a fix on a blocked site or set your workweek. Each walkthrough includes the result from a Mac test.</p><div class="guide-list">${cards()}</div></div>`);
for(const g of guides){
  const related = g === siteBreakGuide ? guides[0] : siteBreakGuide;
  page(guideUrl(g),g.title,g.description,`<article class="article"><a class="back" href="/guides/">← Guides</a><h1>${g.title}</h1><p class="intro">${g.answer}</p><p class="by">Fokus · <time datetime="${g.date}">November 9, 2026</time> · Tested with Fokus 0.4.0 for Mac</p><ol class="steps">${g.steps.map(([h,p])=>`<li><h2>${h}</h2><p>${p}</p></li>`).join('')}</ol><figure><a href="/assets/${g.image}"><img loading="lazy" width="1200" height="860" src="/assets/${g.image}" alt="${g.caption}"></a><figcaption>${g.caption}</figcaption></figure><section><h2>${g.proofTitle}</h2><p>${g.proof}</p><div class="table-scroll"><table><thead><tr>${g.columns.map(s=>'<th scope="col">'+s+'</th>').join('')}</tr></thead><tbody>${g.rows.map(row=>'<tr>'+row.map((s,i)=>i?'<td>'+s+'</td>':'<th scope="row">'+s+'</th>').join('')+'</tr>').join('')}</tbody></table></div></section><p>${g.limit} ${g.source?'<a href="'+g.source[1]+'">'+g.source[0]+'</a>':''}</p><a class="cta" href="${g.href}">${g.link} ${arrow}</a><p class="related">Related guide · <a href="${guideUrl(related)}">${related.short}</a></p></article>`,{article:g});
}
page('/download/','Download Fokus for Apple Silicon Mac','Download the latest Apple Silicon release, install Fokus and start your first puzzle break on Mac.',`<article class="article"><img class="app-icon" src="/assets/ceramic.png" width="88" height="88" alt="Fokus ceramic app icon"><h1>Download Fokus for Mac</h1><p class="intro">Free and open source for Apple Silicon Macs running macOS 12 or later.</p><a class="cta" data-download href="${macDownload}" download>${icon(ArrowDownToLine)} Download Fokus for Mac</a><p class="by">Apple Silicon ZIP · <a href="${latest}">Latest release notes</a></p><h2>Install Fokus</h2><ol><li>Unzip the download and drag Fokus into Applications.</li><li>Open Fokus and choose <strong>Enable blocking</strong>. Approve the macOS administrator prompt to install the local blocker.</li><li>Start a session from <strong>Overview</strong>. Open <strong>Activities</strong> to play a built-in puzzle, or <strong>Daily shelf</strong> for your daily links.</li></ol><details><summary>Why did macOS stop Fokus from opening?</summary><p>Apple hasn’t notarized this preview, so macOS may prevent it from opening. You can <a href="/#whats-new">try the puzzles in your browser</a>.</p></details><details><summary>Verify the download</summary><p>Compare <code>shasum -a 256 Fokus-arm64.zip</code> with the <a href="${checksums}">published SHA-256 checksum</a>.</p></details><p><a href="${releases}">Browse previous releases on GitHub ↗</a></p></article>`);
page('/privacy/','Privacy and measurement','How Fokus handles local website rules and how this website measures visits and downloads.',`<article class="article"><h1>Privacy</h1><h2>What stays on your Mac</h2><p>Your blocking rules stay on your Mac. Fokus does not collect your browsing history.</p><p>After you block a website, you can choose <strong>Share result</strong> in the app. This opens this site with a random receipt so we can count a successful setup. The receipt contains no website or app names.</p><h2>What this website counts</h2><p>We count visits, guide views, demo actions and download clicks. A random ID stored in your browser tab connects those events to the page you first visited, the first guide you opened and a referral category. Direct visits and unknown sources share one category. The measurement database excludes full referrer URLs and IP addresses.</p><p>Clicking a download sets a first-party cookie for seven days. It lets us match an optional setup receipt with a download in the same browser. Puzzle moves in the website preview are saved in this tab. The demo event contains no board or move data.</p><h2>Your choice</h2><p>Do Not Track and Global Privacy Control disable measurement. You can also turn it off for this site in this browser.</p><button id="privacy-choice">Turn off site measurement</button></article>`);
page('/setup-confirmed/','Mac setup receipt','Record an optional confirmation that website blocking is working on your Mac.',`<div class="article"><h1>Share your setup result</h1><p id="receipt-note" role="status">To count a successful setup, choose Share result in Fokus while a website block is active.</p><a href="/">Return to Fokus</a></div>`,{hidden:true});
page('404','Page not found','Return to Fokus to try a puzzle or download the Mac app.',`<div class="article"><h1>Page not found</h1><a href="/">Go to the Fokus homepage</a></div>`,{hidden:true});
save('robots.txt','User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /setup-confirmed/\nSitemap: '+base+'/sitemap.xml\n');
save('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pageRecords.map(([p,d])=>'<url><loc>'+base+p+'</loc><lastmod>'+d+'</lastmod></url>').join('')+'</urlset>');
save('feed.xml','<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Fokus guides</title><link>'+base+'/guides/</link><description>Puzzle breaks and website blocking on Mac</description>'+guides.map(g=>'<item><title>'+esc(g.title)+'</title><description>'+esc(g.description)+'</description><link>'+base+guideUrl(g)+'</link><guid>'+base+guideUrl(g)+'</guid><pubDate>'+new Date(g.date+'T17:00:00Z').toUTCString()+'</pubDate></item>').join('')+'</channel></rss>');
