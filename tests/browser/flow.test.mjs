import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from '../../skills/jev-computer-use/scripts/playwright-adapter.mjs';
import { run, availableActions } from '../../skills/jev-computer-use/bridge.mjs';
import { summarize } from '../../skills/jev-computer-use/scripts/contracts.mjs';

test('real isolated browser: Jev-compatible loop, independent assertions, origin and stale-state checks', async t => {
  const server = createServer((req,res) => {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<title>Jev fixture</title><h1>Automation fixture</h1><button id="report" onclick="document.querySelector(\'#result\').textContent=\'Daily report ready\'">Reports</button><p id="result">No report yet</p><a href="https://outside.invalid/">Outside</a><button>Duplicate</button><button>Duplicate</button>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const dir = await mkdtemp(join(tmpdir(),'jev-browser-test-'));
  const envFile = join(dir,'test.env');
  await writeFile(envFile,'TYPESAFE_API_KEY=synthetic-test-credential\n');
  let browser;
  const originalFetch = globalThis.fetch;
  try {
    browser = await launchBrowser({allowedOrigins:[origin], browser: process.env.JEV_TEST_BROWSER || 'chromium'});
    await browser.page.goto(origin);
    let calls = 0;
    globalThis.fetch = async (url,opts) => {
      assert.equal(url,'https://api.typesafe.ai/v1/systemone');
      assert.equal(opts.redirect,'error');
      const req = JSON.parse(opts.body);
      assert.equal(opts.body.includes('synthetic-test-credential'),false);
      const choice = req.state.browser.includes('Page text: Automation fixture Reports Daily report ready') ? 'DONE' : 'a0';
      calls++;
      return new Response(JSON.stringify({model:'jev-test',answers:{next:{type:'choice',choice,confidence:0.9,probabilities:Object.fromEntries(Object.keys(req.questions.next.criteria).map(k=>[k,k===choice?1:0]))}}}));
    };
    await t.test('click changes actual DOM; independent assertions pass', async () => {
      const outcome = await run(browser.tab,{goal:'Open daily report',controls:[{op:'click',name:'Reports'}],envFile,allowedOrigins:[origin],maxSteps:4});
      assert.equal(outcome.status,'needs_verification');
      assert.equal(await browser.page.locator('#result').innerText(),'Daily report ready');
      const checks = await browser.tab.verify([{type:'text-present',value:'Daily report ready'},{type:'text-absent',value:'No report yet'}]);
      assert.equal(summarize(outcome,checks).verified,true);
      assert.equal(calls,2);
    });
    await t.test('duplicate labels are omitted and external links blocked before click', async () => {
      const state = await browser.tab.getAXState();
      assert.equal(availableActions(state,[{op:'click',name:'Duplicate'}]).length,0);
      const action = availableActions(state,[{op:'click',name:'Outside'}])[0];
      await assert.rejects(()=>browser.tab.click(action.index),/outside allowedOrigins/);
      assert.equal(new URL(browser.page.url()).origin,origin);
    });
    await t.test('changed target invalidates an earlier observation', async () => {
      const state = await browser.tab.getAXState();
      const action = availableActions(state,[{op:'click',name:'Reports'}])[0];
      await browser.page.locator('#report').evaluate(el=>el.textContent='Changed');
      await assert.rejects(()=>browser.tab.click(action.index),/Stale/);
    });
    await t.test('unknown model choice cannot act', async () => {
      globalThis.fetch = async()=>new Response(JSON.stringify({model:'jev-test',answers:{next:{type:'choice',choice:'injected',confidence:1,probabilities:{injected:1}}}}));
      const outcome = await run(browser.tab,{goal:'Open report',controls:[{op:'click',name:'Changed'}],envFile,allowedOrigins:[origin],maxSteps:2});
      assert.equal(outcome.status,'decision_error');
      assert.equal(outcome.history.filter(h=>h.executed).length,0);
    });
  } finally {
    globalThis.fetch=originalFetch;
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
    await rm(dir,{recursive:true,force:true});
  }
});
