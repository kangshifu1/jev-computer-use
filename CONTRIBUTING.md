# Contributing

Keep the runtime independent of any catalog or assistant. New backends implement the
documented tab contract, then test actual browser effects with synthetic pages and mock
model decisions. Do not infer live Jev quality from these tests.

Run `npm ci`, `npx playwright install chromium`, `npm test`, `npm run validate`,
and `npm run test:browser`. Run with `JEV_TEST_BROWSER=chrome` for local Chrome coverage.
Changes to the upstream engine need a documented source/diff update and corresponding
integrity-lock changes. Preserve its copyright and full license.

When adding a control type, specify how it is observed, uniquely targeted, bounded,
executed and independently verified. Ambiguous elements should hand control back instead
of guessing. Do not include credentials, private page captures or user browser profiles
in fixtures. Feature claims must distinguish implemented, tested and proposed support.
