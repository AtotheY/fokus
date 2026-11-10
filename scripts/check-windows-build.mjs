// Public build status and compiler annotations; no credentials required.
const base = 'https://api.github.com/repos/Kismat-Adhikari06/fokus';
async function get(path) {
  const r = await fetch(base + path, { headers: { 'User-Agent': 'Fokus-build-check' } });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${path}`);
  return r.json();
}
const run = process.argv[2]
  ? await get('/actions/runs/' + encodeURIComponent(process.argv[2]))
  : (await get('/actions/runs?branch=windows%2Fport&per_page=1')).workflow_runs[0];
if (!run) throw new Error('No Windows build found.');
console.log(JSON.stringify({id:run.id,status:run.status,conclusion:run.conclusion,url:run.html_url}));
for (const job of (await get(`/actions/runs/${run.id}/jobs`)).jobs) {
  console.log(JSON.stringify({job:job.id,status:job.status,conclusion:job.conclusion,passed:job.steps.filter(s=>s.conclusion==='success').length,steps:job.steps.filter(s=>s.status!=='completed'||s.conclusion!=='success').map(s=>({name:s.name,status:s.status,conclusion:s.conclusion,started:s.started_at}))}));
  if (job.conclusion === 'failure') {
    const checkId = job.check_run_url.split('/').at(-1);
    for (const a of await get(`/check-runs/${checkId}/annotations`)) console.log(JSON.stringify(a));
  }
}
