// Run with node site/scripts/render-share-cards.mjs after changing artwork or copy.
import {createCanvas, loadImage} from '@napi-rs/canvas';
import fs from 'node:fs/promises';
import {pitch, productCard, guideCards} from '../src/search.mjs';

const asset = file => new URL(file, import.meta.url);
const sky = await loadImage(await fs.readFile(asset('../../public/sky.webp')));
const ridges = await loadImage(await fs.readFile(asset('../../public/ridges.webp')));
const icon = await loadImage(await fs.readFile(asset('../../public/icons/ceramic.png')));

const cards = [
  {card: productCard, lines: [pitch.headline[0], 'while your', 'agent codes.'], subtitle: 'Website & app blocker for Mac', proof: 'chess-puzzle.png', crop: [0,70,920,1170]},
  {card: guideCards['what-to-do-while-your-coding-agent-runs'], lines: ['What to do while', 'your coding', 'agent works.'], subtitle: 'A puzzle you can leave mid-game', proof: 'agent-break.jpg', crop: [396,87,410,510]},
  {card: guideCards['temporarily-unblock-one-website'], lines: ['Unblock one site', 'for five minutes', 'on Mac.'], subtitle: 'Keep the rest of your blocklist active', proof: 'mac-site-exception.jpg', crop: [242,72,925,505]},
  {card: guideCards['block-websites-during-working-hours'], lines: ['Block websites', 'on a work', 'schedule.'], subtitle: 'A weekday schedule in Fokus', proof: 'mac-working-hours.jpg', crop: [207,22,865,362]}
];

for (const {card, lines, subtitle, proof, crop} of cards) {
  const canvas = createCanvas(1200,630);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sky,0,0,1200,630);
  const sun = ctx.createLinearGradient(0,275,0,420);
  sun.addColorStop(0,'#fff0cb');
  sun.addColorStop(1,'#deaaa0');
  ctx.fillStyle = sun;
  ctx.beginPath(); ctx.arc(682,351,70,0,Math.PI*2); ctx.fill();
  ctx.drawImage(ridges,0,234,1200,396);
  const shade = ctx.createLinearGradient(0,0,735,0);
  shade.addColorStop(0,'rgba(23,20,34,0.68)');
  shade.addColorStop(1,'rgba(23,20,34,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0,0,1200,630);
  ctx.drawImage(icon,56,52,55,55);
  ctx.fillStyle = '#fcf6fb';
  ctx.font = '600 43px Helvetica Neue';
  ctx.fillText('Fokus',119,95);
  ctx.font = 'bold 62px Helvetica Neue';
  ctx.fillText(lines[0],60,245);
  const wide = crop[2] > crop[3];
  const width = wide ? 478 : 365;
  const x = 1145 - width;
  ctx.font = 'italic 85px Georgia';
  const longestLine = Math.max(...lines.slice(1).map(text => ctx.measureText(text).width));
  const size = Math.min(85, Math.floor(85 * (x - 110) / longestLine));
  ctx.font = `italic ${size}px Georgia`;
  ctx.fillStyle = '#ffe3bd';
  ctx.fillText(lines[1],60,336);
  ctx.fillText(lines[2],60,426);
  ctx.font = '500 27px Helvetica Neue';
  ctx.fillStyle = '#fff8f1';
  ctx.fillText(subtitle,64,524);

  const image = await loadImage(await fs.readFile(asset('../proof/'+proof)));
  const height = width * crop[3] / crop[2];
  const y = (630-height)/2;
  ctx.save();
  ctx.shadowColor = 'rgba(12,10,16,0.55)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#1b1a20';
  ctx.beginPath(); ctx.roundRect(x-17,y-17,width+34,height+34,22); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#ffffff38';
  ctx.stroke();
  ctx.drawImage(image,...crop,x,y,width,height);
  await fs.writeFile(asset('../social/'+card.file),await canvas.encode('jpeg',91));
}
