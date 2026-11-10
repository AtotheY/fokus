// Use the existing Git credential manager session only for GitHub API access.
// Credentials stay in memory and are never logged or written to disk.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const run = process.argv[2];
if (!/^\d+$/.test(run || '')) throw new Error('Pass the Windows Actions run ID.');
const credential = execFileSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
  stdio: ['pipe','pipe','ignore'], env: {...process.env, GCM_INTERACTIVE:'Never'},
});
const password = credential.split('\n').find(s=>s.startsWith('password='))?.slice(9);
if (!password) throw new Error('No existing GitHub credential is available.');
const base = 'https://api.github.com/repos/Kismat-Adhikari06/fokus';
async function get(path) {
  const result = await fetch(base + path, {headers:{Authorization:`Bearer ${password}`, 'User-Agent':'Fokus-build-check'}});
  if (!result.ok) throw new Error(`GitHub returned ${result.status}`);
  return result;
}
await mkdir('dist', {recursive:true});
if (process.argv.includes('--logs')) {
  const response = await get(`/actions/runs/${run}/logs`);
  const path = `dist/windows-build-${run}-logs.zip`;
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  console.log(path);
} else {
  const {artifacts} = await (await get(`/actions/runs/${run}/artifacts`)).json();
  const artifact = artifacts.find(a=>a.name === 'Fokus-windows-x64' && !a.expired);
  if (!artifact) throw new Error('No completed Windows artifact is available.');
  const response = await get(`/actions/artifacts/${artifact.id}/zip`);
  await writeFile('dist/windows-build-artifact.zip', Buffer.from(await response.arrayBuffer()));
  console.log(`Saved dist/windows-build-artifact.zip (artifact ${artifact.id})`);
}
