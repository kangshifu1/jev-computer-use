# Jev Computer Use

Independent project; never import runtime code from jev-skills-market.
Use the installed TypeSafe skill and current https://docs.typesafe.ai/llms.txt guidance.
The MIT upstream engine in `skills/jev-computer-use/vendor/` is pinned by
`upstream.lock.json`. Preserve attribution and document any modifications.

`npm test` checks contracts; `npm run test:browser` uses a real local browser with
mock model responses. Neither proves live Jev quality. Run `npm run validate` before release.
Only claim independent verification when an assertion actually evaluated fresh state.
Credentials, profiles and private captures must stay out of git. The standalone adapter
opens an isolated browser; it does not attach to a user's existing browser session.
