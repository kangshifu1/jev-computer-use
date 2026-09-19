// A shared, isolated browser harness for live Jev and an interactive Codex session.
// The Codex controller chooses each action from the returned fresh observation.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchBrowser} from '../skills/jev-computer-use/scripts/playwright-adapter.mjs';
import {run} from '../skills/jev-computer-use/bridge.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const benchmarkGoal='Open Reports, select the Daily report tab, and turn on Show exceptions only. Stop when Daily report · Exceptions is visible, the filter is checked, and exactly 2 rows are displayed.';
const controls=[{op:'click',name:'Reports'},{op:'click',name:'Daily report'},{op:'click',name:'Show exceptions only'}];
const round=value=>Math.round(value*100)/100;
export function totalTimeMs(sample){
  if([sample.setupMs,sample.loopAndVerificationMs].some(n=>!Number.isFinite(n)||n<0))throw new Error('Invalid duration');
  return round(sample.setupMs+sample.loopAndVerificationMs);
}
export function summarizeSamples(samples){
  const summaries={};
  for(const controller of [...new Set(samples.map(s=>s.controller))]){
    const all=samples.filter(s=>s.controller===controller);
    const passed=all.filter(s=>s.verified);
    const durations=passed.map(s=>s.loopAndVerificationMs).sort((a,b)=>a-b);
    const totals=passed.map(totalTimeMs).sort((a,b)=>a-b);
    if(durations.some(n=>!Number.isFinite(n)||n<0))throw new Error('Invalid duration');
    const n=durations.length;
    summaries[controller]={attempts:all.length,verified:n,medianLoopAndVerificationMs:n?round(n%2?durations[(n-1)/2]:(durations[n/2-1]+durations[n/2])/2):null,minLoopAndVerificationMs:n?durations[0]:null,maxLoopAndVerificationMs:n?durations[n-1]:null};
    Object.assign(summaries[controller],{medianTotalMs:n?round(n%2?totals[(n-1)/2]:(totals[n/2-1]+totals[n/2])/2):null,minTotalMs:n?totals[0]:null,maxTotalMs:n?totals[n-1]:null});
  }
  return summaries;
}

export async function createBenchmark(){
  const html=await readFile(resolve(root,'examples/evidence-fixture.html'));
  const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const samples=[];
  let active=null;
  async function timed(call){
    const start=performance.now();
    try{return await call();}finally{active.browserToolMs+=performance.now()-start;}
  }
  async function begin(controller){
    if(active)throw new Error('Finish the current trial first');
    const setupStart=performance.now();
    const runtime=await launchBrowser({browser:'chrome',headless:true,allowedOrigins:[origin]});
    try{
      await runtime.page.setViewportSize({width:1440,height:940});
      await runtime.page.goto(origin,{waitUntil:'load'});
    }catch(error){await runtime.close();throw error;}
    active={controller,runtime,observedAt:new Date().toISOString(),browserVersion:runtime.page.context().browser().version(),setupMs:performance.now()-setupStart,browserToolMs:0,actions:[],observations:0,start:performance.now()};
    const tab=runtime.tab;
    active.tab={
      getAXState:async()=>{active.observations++;return timed(()=>tab.getAXState());},
      click:async index=>{const start=performance.now();await timed(()=>tab.click(index));active.actions.push({op:'click',index,elapsedMs:round(performance.now()-start)});},
      pressKey:key=>timed(()=>tab.pressKey(key)),
      reload:()=>timed(()=>tab.reload())
    };
  }
  async function finish(extra={}){
    if(!active)throw new Error('No active trial');
    const page=active.runtime.page;
    const actual=await timed(async()=>({title:await page.locator('#report-title').innerText(),rows:await page.locator('#rows tr').count(),filter:await page.locator('#exceptions').isChecked(),dailySelected:await page.locator('#daily').getAttribute('aria-selected')}));
    const checks=[{name:'Daily exceptions heading',pass:actual.title==='Daily report · Exceptions'},{name:'Two visible records',pass:actual.rows===2},{name:'Exception filter checked',pass:actual.filter},{name:'Daily tab selected',pass:actual.dailySelected==='true'}];
    const elapsed=performance.now()-active.start;
    const report={controller:active.controller,trial:samples.filter(s=>s.controller===active.controller).length+1,observedAt:active.observedAt,browserVersion:active.browserVersion,setupMs:round(active.setupMs),loopAndVerificationMs:round(elapsed),browserToolMs:round(active.browserToolMs),hostRoundTripAndReasoningMs:active.controller==='codex-session'?round(elapsed-active.browserToolMs):null,actions:active.actions,observations:active.observations,actual,checks,verified:checks.every(c=>c.pass)&&extra.completed!==false,...extra};
    report.totalMs=totalTimeMs(report);
    samples.push(report);
    const runtime=active.runtime;active=null;
    await runtime.close();
    return report;
  }
  return {
    async beginCodex(){await begin('codex-session');return {goal:benchmarkGoal,observation:await active.tab.getAXState()};},
    async click(index){
      if(active?.controller!=='codex-session')throw new Error('No Codex trial');
      if(active.actions.length>=8||performance.now()-active.start>120000)throw new Error('Trial budget exceeded');
      await active.tab.click(index);
      return {observation:await active.tab.getAXState()};
    },
    async finishCodex(){if(active?.controller!=='codex-session')throw new Error('No Codex trial');return finish({model:'current Codex session; exact model variant not exposed',providerMs:null,completed:true});},
    async runJev(envFile){
      await begin('jev');
      try{
        const result=await run(active.tab,{goal:benchmarkGoal,controls,allowedOrigins:[origin],envFile,provider:'typesafe',model:'jev-latest',maxSteps:8,maxMs:45000});
        return finish({model:result.history.find(h=>h.model)?.model??null,providerMs:result.history.reduce((sum,h)=>sum+(h.apiMs??0),0),decisions:result.history.length,engineStatus:result.status,completed:result.status==='needs_verification',decisionTrace:result.history.map(({choice,confidence,action,executed,apiMs})=>({choice,confidence,action,executed:!!executed,apiMs}))});
      }catch{const report=await finish({model:null,providerMs:null,completed:false,error:'Jev trial failed; raw provider details withheld'});return report;}
    },
    async save(path){
      if(active)throw new Error('Finish the current trial before saving');
      const report={kind:'same-adapter-controller-comparison',observedAt:new Date().toISOString(),goal:benchmarkGoal,protocol:{browser:'Isolated headless Chrome',viewport:{width:1440,height:940},syntheticDataOnly:true,artificialDelays:false,ordering:'Alternating Jev and Codex',codexActionPolicy:'One observed click then a fresh snapshot per model/tool round trip',timing:'Start before initial observation; stop after four independent DOM checks. Browser launch/navigation reported separately; browser close and report serialization excluded.',totalTiming:'totalMs = setupMs + loopAndVerificationMs per trial; summary medianTotalMs is the median of these paired totals. Excludes harness setup, browser close and report serialization.',nativeCodexBrowserSkillTested:false,codexModelOnlyLatencyAvailable:false,limitations:['This measures the current interactive Codex session plus the shared Playwright adapter, not the native Codex Browser Skill.','Codex wall time includes model reasoning, tool transport, scheduling and any gaps between calls; provider-only timing is unavailable.','Both controllers know the same repeated synthetic task; the current Codex conversation already contains its prior demo.','Three trials per controller are descriptive observations, not a general product speed or quality benchmark.']},summary:summarizeSamples(samples),samples};
      await writeFile(path,JSON.stringify(report,null,2)+'\n');
      return {summary:report.summary,path};
    },
    async close(){if(active){await active.runtime.close();active=null;}await new Promise(resolve=>server.close(resolve));}
  };
}
