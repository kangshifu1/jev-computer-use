# Existing Codex browser connection

Use only a browser tool actually declared in the current host. Read its bootstrap and
tab documentation. An open browser panel does not establish tool access. Do not invent
`cua_repl` calls when that namespace is absent. An existing tab must be found with the
host's documented discovery API, not replaced with a new standalone browser.

After obtaining the authorized tab, import the installed skill's absolute path:

```js
var jev = await import('file:///absolute/skill/path/bridge.mjs');
var config = await jev.loadConfig();
var session = jev.createSession(tab, {
  ...config, allowedOrigins: ['https://example.com'],
  maxSteps: 8, maxMs: 45000, minConfidence: 0.55
});
var result = await session.run({
  goal: 'Open Reports and stop when the daily report is visible.',
  controls: [{op: 'click', name: 'Reports'}]
});
```

Replace the sample path, origin and task with observed values. The tab contract is
`getAXState({emit:false,disableDiffing:true}) -> string`, `click(index)`,
`pressKey(key)`, `reload()`, and optionally `scroll(target,direction,amount)`.
The state string uses `Browser tab: ... URL: "https://...".` followed by indexed
`number role name` lines. A different API requires a tested adapter.

Keep one session across host text-entry/visual handoffs. Independently verify after
`needs_verification`; report blocked/uncertain work without presenting it as complete.
No live Codex runtime compatibility has been verified by this fork's release tests.
