# Runtime contract v0.1.0

`run(tab, options)` accepts an existing authorized tab and a task. The engine never
opens a browser. `createSession(tab, defaults)` keeps history across bounded runs.

```js
import { run } from '../skills/jev-computer-use/bridge.mjs';
import { launchBrowser } from '../skills/jev-computer-use/scripts/playwright-adapter.mjs';
const origins = ['https://example.com'];
const runtime = await launchBrowser({browser:'chromium',headless:true,allowedOrigins:origins});
try {
  await runtime.page.goto('https://example.com');
  const outcome = await run(runtime.tab, {
    goal:'Open Reports', controls:[{op:'click',name:'Reports'}],
    allowedOrigins:origins, provider:'typesafe', model:'jev-latest',
    envFile:'/absolute/path/credentials.env', maxSteps:8, maxMs:45000
  });
  // A host decides which independent business assertions to check.
  if (outcome.status === 'needs_verification') {
    const assertions = await runtime.tab.verify([{type:'text-present',value:'Daily report'}]);
    console.log(assertions);
  }
} finally { await runtime.close(); }
```

The example URL/control is illustrative; use your actual site. Install Playwright in
the checkout or installed Skill directory before importing the standalone adapter.

The bridge contract and result statuses follow the pinned upstream engine. Treat
`history` and `state` as potentially private. Its elapsed budget prevents new actions
but cannot interrupt an in-flight browser call. It currently has no AbortSignal input.
A voice adapter must stop scheduling runs on cancellation; to stop an independent
browser promptly, close its owned runtime and then inspect whether effects already
committed. Closing a browser cannot undo a server-side write. Never close a user's
shared Codex tab as a cancellation mechanism without appropriate scope.

`run` controls can use named clicks, page scrolling and reload. The standalone CLI
narrows the interface further with a task validator and explicit assertions. Advanced
upstream APIs should only be used by a host that understands their runtime requirements.
