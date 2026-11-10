// Packaged WebView2 smoke test on an isolated Windows CI runner.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import assert from 'node:assert/strict';
if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true')
  throw new Error('Run this desktop smoke test only on the temporary Windows CI runner.');
const folder = await mkdtemp(join(tmpdir(), 'fokus-desktop-'));
const child = spawn(resolve('dist/Fokus-windows-x64/Fokus.exe'), [], {windowsHide:true, env:{
  ...process.env, FOKUS_TEST_DIRECTORY:folder, FOKUS_DISABLE_ACTIVE_COUNT:'1',
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9222',
  WEBVIEW2_USER_DATA_FOLDER:join(folder,'webview'),
}});
child.stdout.on('data',data=>process.stdout.write(data));
child.stderr.on('data',data=>process.stderr.write(data));
const delay = ms => new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let target;
  let diagnostic='No connection attempted';
  for (let n=0; n<90; n++) {
    if (child.exitCode !== null) throw new Error(`Fokus exited with ${child.exitCode}`);
    try {
      const targets=await (await fetch('http://127.0.0.1:9222/json')).json();
      diagnostic=JSON.stringify(targets);
      target=targets.find(t=>t.type==='page'||t.type==='webview');
    } catch(error) { diagnostic=error.message; }
    if (target) break;
    await delay(500);
  }
  if(!target) {
    console.error('WebView2 connection:',diagnostic);
    try { console.error(execFileSync('powershell.exe',['-NoProfile','-Command',"Get-Process Fokus,msedgewebview2 -ErrorAction SilentlyContinue | Select-Object Name,Id,MainWindowHandle,MainWindowTitle,SessionId | Format-Table -AutoSize"],{encoding:'utf8'})) } catch {}
  }
  assert(target, 'WebView2 debug target did not open');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  let sequence=0;
  const pending=new Map();
  ws.onmessage=({data})=>{ const m=JSON.parse(data); if(m.id) {const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)} };
  async function cdp(method,params={}) {
    const id=++sequence;
    const result=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
    ws.send(JSON.stringify({id,method,params}));
    return Promise.race([result, delay(15000).then(()=>{throw new Error(`Timeout: ${method}`)})]);
  }
  async function evaluate(expression) {
    const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  for(let n=0;n<40;n++) { if(await evaluate('document.querySelectorAll("button").length > 5')) break; await delay(250) }
  assert(await evaluate('document.querySelectorAll("button").length > 5'), 'React UI did not render');
  const invoke=(name,args={})=>evaluate(`window.__TAURI__.core.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
  const status=await invoke('focus_request',{action:{type:'status'}});
  assert.equal(status.ready,false);
  assert(Array.isArray(status.rules.groups));
  assert.equal((await invoke('new_board',{game:'Minesweeper'})).order.length,64);
  assert(Array.isArray(await invoke('installed_apps')));
  assert(Object.keys(await invoke('theme_files',{open:false})).length>0);
  await invoke('appearance',{icon:'ceramic',mode:'dark',blur:false});
  assert.equal((await invoke('comet_status')).available,false);
  await evaluate(`window.dispatchEvent(new CustomEvent('fokus-menu',{detail:'settings'}))`);
  await delay(500);
  assert((await evaluate('document.body.innerText')).includes('Settings'));
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile('dist/windows-desktop-smoke.png',Buffer.from(screenshot.data,'base64'));
  console.log('PASS: packaged Windows UI, native IPC commands, puzzles, app scanner, themes, icon and Settings.');
} finally {
  ws?.close();
  try { execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'}) } catch {}
  assert(resolve(folder).startsWith(resolve(tmpdir()) + sep), 'Temporary folder escaped the test directory');
  await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:500});
}
