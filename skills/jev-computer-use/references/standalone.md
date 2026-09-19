# Standalone browser

Node.js 22+ is required. From a repository checkout run `npm ci`, then
`npx playwright install chromium`. For a standalone Skill install, run
`npm install --prefix <absolute-skill-directory>` and install Chromium using that
directory's Playwright executable. Chrome can use an already installed browser via
`--browser chrome`; the default is managed Chromium. Neither mode reuses a personal profile.

Create a task using the structure in the repository's `examples/browser-task.json`:

```json
{
  "goal": "Open reports and check that the daily report appears",
  "startUrl": "http://127.0.0.1:8769",
  "allowedOrigins": ["http://127.0.0.1:8769"],
  "controls": [{"op":"click","name":"Reports"}],
  "assertions": [{"type":"text-present","value":"Daily report"}],
  "maxSteps": 6
}
```

Run from the installed skill directory:

```sh
node scripts/cli.mjs --task /absolute/path/task.json
node scripts/cli.mjs --task /absolute/path/task.json --config /absolute/path/config.json --act --headed
```

The first command only validates and previews; no page or model is contacted. The second
calls the selected provider and runs the task. An example config is:

```json
{"provider":"typesafe","model":"jev-latest","envFile":"/absolute/path/credentials.env"}
```

The adapter reads standard visible top-level HTML controls and converts their roles,
labels and state to the engine's indexed text format. It is a DOM-derived observation,
not a complete operating-system accessibility tree. Only page scrolling is supported;
targeted scrolling and frames require host intervention. Duplicate control names are
not automatically clicked. Main-page navigation outside the origin list is blocked,
but third-party resources may still load: this is not a network sandbox.

No screenshots or private traces are written automatically. The CLI returns a compact
assertion report and closes its isolated browser, including on failure. Press Ctrl-C
to stop the CLI; inspect actual state before retrying any operation with external effects.
