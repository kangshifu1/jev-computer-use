#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { run } from '../bridge.mjs';
import { launchBrowser } from './playwright-adapter.mjs';
import { validateTask, summarize } from './contracts.mjs';

try {
  const { values } = parseArgs({ options: {
    task: { type: 'string' }, config: { type: 'string' }, browser: { type: 'string', default: 'chromium' },
    act: { type: 'boolean', default: false }, headed: { type: 'boolean', default: false }, help: { type: 'boolean' }
  } });
  if (values.help || !values.task) {
    console.log('Usage: node scripts/cli.mjs --task task.json [--act --config config.json] [--browser chromium|chrome] [--headed]\nDefault: validate and preview; no browser or model calls. --act starts an isolated browser.');
    if (!values.help) process.exitCode = 2;
  } else {
    const task = validateTask(JSON.parse(await readFile(values.task, 'utf8')));
    if (!values.act) console.log(JSON.stringify({ mode: 'preview', task }, null, 2));
    else {
      if (!values.config) throw new Error('--config is required for live actions');
      const config = JSON.parse(await readFile(values.config, 'utf8'));
      if (!['typesafe', 'openrouter'].includes(config.provider) || typeof config.envFile !== 'string' || !config.envFile.startsWith('/')) throw new Error('Config needs provider and an absolute envFile path');
      const runtime = await launchBrowser({ browser: values.browser, headless: !values.headed, allowedOrigins: task.allowedOrigins });
      try {
        await runtime.page.goto(task.startUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const outcome = await run(runtime.tab, { envFile: config.envFile, provider: config.provider, model: config.model,
          goal: task.goal, controls: task.controls, allowedOrigins: task.allowedOrigins,
          maxSteps: task.maxSteps ?? 10, maxMs: task.maxMs ?? 45000, minConfidence: task.minConfidence ?? 0.55 });
        const assertions = outcome.status === 'needs_verification' ? await runtime.tab.verify(task.assertions) : task.assertions.map(a => ({ ...a, status: 'not-covered' }));
        const report = summarize(outcome, assertions);
        console.log(JSON.stringify(report, null, 2));
        if (!report.verified) process.exitCode = 1;
      } finally { await runtime.close(); }
    }
  }
} catch (error) {
  // Do not expose browser page excerpts, model response bodies or credentials.
  const safe = /^(Task needs|Origins must|startUrl|Only explicit|Standalone tasks|Unsupported assertion|Assertion URL|Supported browsers|--config|Config needs)/.test(error.message);
  console.error(safe ? error.message : 'Run failed. Check task, credentials, browser installation and permitted origins. Raw error details are withheld.');
  process.exitCode = 1;
}
