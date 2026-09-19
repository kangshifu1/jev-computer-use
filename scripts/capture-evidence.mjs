// Explicit documentation capture on a synthetic page. Never visits personal tabs.
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const skill=resolve(process.env.JEV_SKILL_DIR || join(root,'skills/jev-computer-use'));
const {run}=await import(pathToFileURL(join(skill,'bridge.mjs')).href);
const {launchBrowser}=await import(pathToFileURL(join(skill,'scripts/playwright-adapter.mjs')).href);
const skillVersion=JSON.parse(await readFile(join(skill,'package.json'),'utf8')).version;
let server,dir,runtime;
try {
  const key=process.env.TYPESAFE_API_KEY;
  if(!key)throw new Error('TYPESAFE_API_KEY is required');
  const html=await readFile(join(root,'examples/evidence-fixture.html'));
  server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  dir=await mkdtemp(join(tmpdir(),'jev-evidence-'));
  const envFile=join(dir,'key.env');
  await writeFile(envFile,`TYPESAFE_API_KEY=${JSON.stringify(key)}\n`,{mode:0o600});
  const controls=[{op:'click',name:'Reports'},{op:'click',name:'Daily report'},{op:'click',name:'Show exceptions only'}];
  const goal='Open Reports, select the Daily report tab, and turn on Show exceptions only. Stop when the Daily report · Exceptions heading is visible, the filter is checked and exactly 2 rows are displayed. Do not change the page again after completion.';
  const reports=[];
  await mkdir(join(root,'docs/screenshots'),{recursive:true});
  for(const browser of ['chromium','chrome']) {
    runtime=await launchBrowser({browser,allowedOrigins:[origin]});
    await runtime.page.setViewportSize({width:1440,height:940});
    await runtime.page.goto(origin);
    await runtime.page.evaluate(()=>document.fonts.ready);
    const browserVersion=runtime.page.context().browser().version();
    if(browser==='chromium')await runtime.page.screenshot({path:join(root,'docs/screenshots/browser-before.png'),fullPage:true});
    const outcome=await run(runtime.tab,{goal,controls,allowedOrigins:[origin],envFile,provider:'typesafe',model:'jev-latest',maxSteps:8,maxMs:45000});
    const actual={title:await runtime.page.locator('#report-title').innerText(),rows:await runtime.page.locator('#rows tr').count(),filter:await runtime.page.locator('#exceptions').isChecked(),dailySelected:await runtime.page.locator('#daily').getAttribute('aria-selected')};
    const checks=[{name:'Daily exceptions heading',pass:actual.title==='Daily report · Exceptions'},{name:'Exactly two visible records',pass:actual.rows===2},{name:'Exception filter checked',pass:actual.filter},{name:'Daily tab selected',pass:actual.dailySelected==='true'}];
    const verified=outcome.status==='needs_verification'&&checks.every(c=>c.pass);
    if(browser==='chromium')await runtime.page.screenshot({path:join(root,'docs/screenshots/browser-after.png'),fullPage:true});
    reports.push({browser,browserVersion,skillVersion,status:outcome.status,verified,checks,actual,elapsedMs:outcome.elapsedMs,decisionTrace:outcome.history.map(h=>({choice:h.choice,confidence:h.confidence,executed:!!h.executed,action:h.action,model:h.model,apiMs:h.apiMs}))});
    await runtime.close();runtime=null;
  }
  const task={goal,startUrl:origin+'/',allowedOrigins:[origin],controls,assertions:[{type:'text-present',value:'Daily report · Exceptions'},{type:'text-present',value:'2 rows'}],maxSteps:8};
  const taskFile=join(dir,'task.json'),configFile=join(dir,'config.json');
  await writeFile(taskFile,JSON.stringify(task));
  await writeFile(configFile,JSON.stringify({provider:'typesafe',model:'jev-latest',envFile}),{mode:0o600});
  const cli=join(skill,'scripts/cli.mjs');
  const preview=JSON.parse((await exec(process.execPath,[cli,'--task',taskFile],{cwd:dir})).stdout);
  let liveCli;
  try{liveCli=JSON.parse((await exec(process.execPath,[cli,'--task',taskFile,'--config',configFile,'--act'],{cwd:dir,timeout:80000})).stdout);}catch(error){liveCli={verified:false,exitCode:error.code??1};}
  const report={kind:'installed-skill-live-usage-and-screenshots',observedAt:new Date().toISOString(),distribution:'GitHub release v'+skillVersion,installedViaSkillsCli:!!process.env.JEV_SKILL_DIR,syntheticDataOnly:true,browserRuns:reports,installedCli:{previewPassed:preview.mode==='preview',live:liveCli},screenshots:['screenshots/browser-before.png','screenshots/browser-after.png'],limitations:['Two local synthetic browser runs and one CLI run, not a website compatibility benchmark.','No native Codex browser connection, authenticated sites, desktop apps or speech tested.']};
  report.screenshotSha256={};
  for(const name of report.screenshots)report.screenshotSha256[name]=createHash('sha256').update(await readFile(join(root,'docs',name))).digest('hex');
  await writeFile(join(root,'docs/usage-verification-2026-09-19.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(reports.some(r=>!r.verified)||!report.installedCli.previewPassed||!liveCli.verified)process.exitCode=1;
}catch(error){console.error(error.message==='TYPESAFE_API_KEY is required'?error.message:'Evidence capture failed; raw errors and credentials are withheld.');process.exitCode=1;}
finally{if(runtime)await runtime.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));if(dir)await rm(dir,{recursive:true,force:true});}
