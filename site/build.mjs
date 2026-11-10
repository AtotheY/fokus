import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
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
for(const name of fs.readdirSync(path.join(root,'proof'))) fs.copyFileSync(path.join(root,'proof',name),path.join(assets,name));
for(const file of ['site.css','showcase.css','showcase.js','demo.js','measure.js']) fs.copyFileSync(path.join(root,'src',file),path.join(assets,file));
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
  save(url==='404'?'404.html':url.slice(1)+'index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Fokus</title><meta name="description" content="${esc(desc)}">${hidden?'<meta name="robots" content="noindex">':'<link rel="canonical" href="'+base+url+'">'}<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${base}/assets/ceramic.png"><link rel="icon" href="/assets/ceramic.png"><link rel="stylesheet" href="/assets/site.css">${home?'<link rel="stylesheet" href="/assets/showcase.css">':''}<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Fokus guides">${tags?'<script type="application/ld+json">'+JSON.stringify(tags)+'</script>':''}<script defer src="/assets/measure.js"></script></head><body class="${home?'home':''}"><a class="skip" href="#main">Skip to content</a><header class="nav"><div>${brand}<nav aria-label="Main"><a href="/#sample">Features</a><a href="/#whats-new">What’s new</a><a href="${repository}">GitHub ↗</a></nav></div></header><main id="main">${body}</main><footer>${brand}<div class="footer-links"><a href="${repository}">Source code ↗</a><a href="${releases}">Releases</a></div><a href="/privacy/">Privacy</a></footer></body></html>`);
  if(!hidden)pageRecords.push([url,article?.date??date]);
}
const guideIcons = {
  'what-to-do-while-your-coding-agent-runs': Gamepad2,
  'block-websites-during-working-hours': CalendarClock
};
const siteBreakGuide = guides.find(guide => guide.slug === 'temporarily-unblock-one-website');
function cards(){return guides.map(g=>`<a class="guide-row" href="${guideUrl(g)}"><span class="glyph">${icon(guideIcons[g.slug] ?? Clock3,22)}</span><span>${g.short}</span>${icon(ArrowUpRight,17)}</a>`).join('')}
page('/','Stop doomscrolling while your coding agent works','Block distracting sites and Mac apps between prompts. Set recurring hours, open one site on a timer, and take a break with saved games and a daily puzzle tracker.',showcase({zip:macDownload, repository}),{home:true});
page('/guides/','Fokus guides for blocking websites on Mac','Try a break between prompts, time a site exception, or schedule website blocks on your Mac.',`<div class="article"><p class="eyebrow">Fokus for Mac</p><h1>Guides</h1><p class="intro">Block your feeds, take a break between prompts, or open one site on a timer.</p><div class="guide-list">${cards()}</div></div>`);
for(const g of guides){
  const related = g === siteBreakGuide ? guides[0] : siteBreakGuide;
  page(guideUrl(g),g.title,g.description,`<article class="article"><a class="back" href="/guides/">← Guides</a><h1>${g.title}</h1><p class="intro">${g.answer}</p><p class="by">Fokus · <time datetime="${g.date}">November 9, 2026</time> · Mac preview 0.4.0</p><ol class="steps">${g.steps.map(([h,p])=>`<li><h2>${h}</h2><p>${p}</p></li>`).join('')}</ol><figure><a href="/assets/${g.image}"><img loading="lazy" width="1200" height="860" src="/assets/${g.image}" alt="${g.caption}"></a><figcaption>${g.caption}</figcaption></figure><section><h2>${g.proofTitle}</h2><p>${g.proof}</p><div class="table-scroll"><table><thead><tr>${g.columns.map(s=>'<th scope="col">'+s+'</th>').join('')}</tr></thead><tbody>${g.rows.map(row=>'<tr>'+row.map((s,i)=>i?'<td>'+s+'</td>':'<th scope="row">'+s+'</th>').join('')+'</tr>').join('')}</tbody></table></div></section><p>${g.limit} ${g.source?'<a href="'+g.source[1]+'">'+g.source[0]+'</a>':''}</p><a class="cta" href="${g.href}">${g.link} ${arrow}</a><p class="related">Related guide · <a href="${guideUrl(related)}">${related.short}</a></p></article>`,{article:g});
}
page('/download/','Download Fokus for Apple Silicon Mac','Get the free Fokus Mac preview, check compatibility, and enable your first website block.',`<article class="article"><img class="app-icon" src="/assets/ceramic.png" width="88" height="88" alt="Fokus ceramic app icon"><h1>Fokus for Mac</h1><p class="intro">Free for Apple Silicon Macs running macOS 12 or later.</p><a class="cta" data-download href="${macDownload}" download>${icon(ArrowDownToLine)} Download Mac preview</a><p class="by">Apple Silicon · ZIP · <a href="${latest}">Latest release notes</a></p><h2>Install Fokus</h2><ol><li>Unzip Fokus and move it to Applications.</li><li>Open the app and choose <strong>Enable blocking</strong>. macOS asks for an administrator password to install the local blocker.</li></ol><details><summary>Mac won’t open Fokus?</summary><p>This preview is not notarized by Apple. If macOS prevents it from opening, you can try the <a href="/#sample">interactive preview</a> without installing anything.</p></details><details><summary>Verify the download</summary><p>Compare <code>shasum -a 256 Fokus-arm64.zip</code> with the <a href="${checksums}">published SHA-256 checksum</a>.</p></details><p><a href="${releases}">All published versions on GitHub ↗</a></p></article>`);
page('/privacy/','Privacy and measurement','How Fokus handles local website rules and how this website measures visits and downloads.',`<article class="article"><h1>Privacy</h1><p>The Mac helper keeps your rules on your Mac. Fokus does not collect browsing history. An optional Share result action opens this site with a random receipt after the helper reports an active website block. The receipt contains no domains or app names.</p><h2>Website measurement</h2><p>This site uses a random visit ID in tab storage to count visits, guide views, demo actions and download clicks. It records the entry page, first guide and referral category. Downloading sets a first-party cookie for seven days to match an optional setup receipt in the same browser. Direct and unknown sources stay grouped. We do not store full referrer URLs or IP addresses in the measurement database.</p><p>Do Not Track and Global Privacy Control disable these events. You can also <button id="privacy-choice">turn off site measurement</button>.</p></article>`);
page('/setup-confirmed/','Mac setup receipt','Anonymous setup receipt from Fokus for Mac.',`<div class="article"><h1>Setup receipt</h1><p id="receipt-note" role="status">Share result in the Mac app opens this page during an active block.</p><a href="/">Return to Fokus</a></div>`,{hidden:true});
page('404','Page not found','This Fokus page could not be found.',`<div class="article"><h1>Page not found</h1><a href="/">Return to Fokus</a></div>`,{hidden:true});
save('robots.txt','User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /setup-confirmed/\nSitemap: '+base+'/sitemap.xml\n');
save('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pageRecords.map(([p,d])=>'<url><loc>'+base+p+'</loc><lastmod>'+d+'</lastmod></url>').join('')+'</urlset>');
save('feed.xml','<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Fokus guides</title><link>'+base+'/guides/</link><description>Tested Mac blocking workflows</description>'+guides.map(g=>'<item><title>'+esc(g.title)+'</title><description>'+esc(g.description)+'</description><link>'+base+guideUrl(g)+'</link><guid>'+base+guideUrl(g)+'</guid><pubDate>'+new Date(g.date+'T17:00:00Z').toUTCString()+'</pubDate></item>').join('')+'</channel></rss>');
