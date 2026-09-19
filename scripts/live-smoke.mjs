// Opt-in paid API smoke test using synthetic data only. Never part of default CI.
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {run} from '../skills/jev-computer-use/bridge.mjs';
import {launchBrowser} from '../skills/jev-computer-use/scripts/playwright-adapter.mjs';
import {summarize} from '../skills/jev-computer-use/scripts/contracts.mjs';

let runtime,server,dir;
try {
  const key=process.env.TYPESAFE_API_KEY;
  if(!key) throw new Error('TYPESAFE_API_KEY is required');
  dir=await mkdtemp(join(tmpdir(),'jev-live-'));
  const envFile=join(dir,'credential.env');
  await writeFile(envFile,`TYPESAFE_API_KEY=${JSON.stringify(key)}\n`,{mode:0o600});
  server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<title>Jev live smoke fixture</title><h1>Report center</h1><button onclick="document.getElementById(\'status\').textContent=\'Daily report ready\'">Reports</button><p id="status">No report loaded</p>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  runtime=await launchBrowser({allowedOrigins:[origin]});
  await runtime.page.goto(origin);
  const outcome=await run(runtime.tab,{goal:'Open Reports. Stop as soon as the page visibly says Daily report ready. Do not click again after that.',controls:[{op:'click',name:'Reports'}],allowedOrigins:[origin],envFile,provider:'typesafe',model:process.env.TYPESAFE_MODEL||'jev-latest',maxSteps:6,maxMs:45000});
  const checks=await runtime.tab.verify([{type:'text-present',value:'Daily report ready'},{type:'text-absent',value:'No report loaded'}]);
  const report={kind:'live-typesafe-and-real-chromium',observedAt:new Date().toISOString(),...summarize(outcome,checks),models:[...new Set(outcome.history.map(h=>h.model).filter(Boolean))],decisionTrace:outcome.history.map(h=>({choice:h.choice,confidence:h.confidence,executed:!!h.executed,apiMs:h.apiMs})),limitations:'One synthetic task. Does not establish general model accuracy, visual coverage, Codex runtime compatibility or production reliability.'};
  console.log(JSON.stringify(report,null,2));
  if(!report.verified) process.exitCode=1;
} catch(error) {
  console.error(error.message==='TYPESAFE_API_KEY is required'?error.message:'Live smoke failed. No credentials or raw provider responses were logged.');
  process.exitCode=1;
} finally {
  if(runtime) await runtime.close();
  if(server?.listening) await new Promise(resolve=>server.close(resolve));
  if(dir) await rm(dir,{recursive:true,force:true});
}
