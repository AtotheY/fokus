import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import worker from '../site/worker.mjs';
const db=new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../site/schema.sql',import.meta.url),'utf8'));
const env={DB:{prepare(sql){return {run:()=>db.prepare(sql).run(),bind:(...args)=>({run:()=>db.prepare(sql).run(...args)})}}}};
const origin='https://usefokus.dev';
function post(endpoint,body,headers={}){
  const data=body && JSON.stringify(body);
  return worker.fetch(new Request(origin+endpoint,{method:'POST',headers:{...(data && {origin,'content-type':'application/json','content-length':String(data.length)}),...headers},body:data}),env);
}
test('aggregate only valid traffic; repeat views count; opted-out loads do not',async()=>{
  const view={page:'/',kind:'view',source:'google'};
  for(const data of [view,view,{...view,kind:'visit'}])assert.equal((await post('/api/event',data)).status,204);
  for(const hdr of [{dnt:'1'},{'sec-gpc':'1'},{'user-agent':'GPTBot'}])await post('/api/event',view,hdr);
  assert.equal((await post('/api/event',{...view,page:'/?private'})).status,400);
  assert.equal((await post('/api/event',{...view,source:'private hostname'})).status,400);
  assert.equal((await post('/api/event',view,{origin:'https://unrelated.test'})).status,403);
  assert.deepEqual({...db.prepare('SELECT source,page_views,entries FROM website_traffic').get()},{source:'google',page_views:2,entries:1});
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n,0);
});
test('native counter accepts empty posts; no browser calls and no details',async()=>{
  for(const hdr of [{},{origin,'x-fokus-count':'1'}])assert.equal((await post('/api/active',null,hdr)).status,403);
  assert.equal((await worker.fetch(new Request(origin+'/api/active',{method:'POST',body:'x',headers:{'x-fokus-count':'1'}}),env)).status,400);
  assert.equal((await post('/api/active',null,{'x-fokus-count':'1'})).status,204);
  assert.deepEqual({...db.prepare('SELECT * FROM daily_activity').get()},{utc_date:new Date().toISOString().slice(0,10),active_devices:1});
});
test('tab keeps only a coarse source across navigation and reloads; privacy controls suppress posts',()=>{
  const code=readFileSync(new URL('../site/src/measure.js',import.meta.url),'utf8');
  function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
  const sessionStorage=storage(),localStorage=storage(),events=[];
  function visit(path,referrer,type='navigate',navigator={}){
    const choice={};const c={window:{},URL,URLSearchParams,location:new URL(path,origin),performance:{getEntriesByType:()=>[{type}]},navigator,sessionStorage,localStorage,
      document:{referrer,cookie:'',querySelector:s=>s==='#privacy-choice'?choice:null,addEventListener(){}},
      fetch:(_,opts)=>{assert.equal(opts.referrerPolicy,'no-referrer');assert.equal(opts.credentials,'omit');events.push(JSON.parse(opts.body));return Promise.resolve({ok:true})}};
    vm.runInNewContext(code,c);return choice;
  }
  visit('/?utm_source=github&private=abc','https://github.com/private');
  visit('/?utm_source=github&private=abc','https://github.com/private','reload');
  const opt=visit('/privacy/',origin+'/');
  assert.deepEqual(events.map(e=>e.kind),['visit','view','view','view']);
  assert(events.every(e=>e.source==='github'&&Object.keys(e).sort().join()==='kind,page,source'));
  opt.onclick();visit('/',origin+'/privacy/');assert.equal(events.length,4);
  localStorage.removeItem('fokus-measure-off');
  visit('/','', 'navigate',{globalPrivacyControl:true});visit('/','','navigate',{doNotTrack:'1'});assert.equal(events.length,4);
});
