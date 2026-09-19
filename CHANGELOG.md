# Changelog

## v0.1.1 — 2026-09-19 — live smoke verification

- Add an opt-in live TypeSafe smoke script using an isolated local Chromium fixture.
- Real `jev-1.13.0` selected one Reports click and then DONE; two independent assertions passed.
- Observed loop time: 1,452 ms for this single run, including two model decisions. No speed comparison is implied.
- Publish sanitized evidence, exclude local YAML credential filenames, and keep API tests outside default CI.
- This does not establish general task accuracy or live Codex runtime compatibility.

## v0.1.0 — 2026-09-19 — developer preview

- Independent repository and installable `jev-computer-use` skill; no market dependency.
- Pin and preserve the MIT Jev Browser Use engine with commit and SHA-256 attribution.
- Add isolated Playwright Chrome/Chromium adapter and stable host bridge entry point.
- Add validated task contracts, preview-first CLI and independent text/URL assertions.
- Add CI, package validation, 4 contract tests and 4 browser scenarios.

Release validation: contract tests passed; browser scenarios passed with both real local
Chromium and installed Chrome, using simulated TypeSafe responses. Skill discovery,
Skill frontmatter, plugin manifest and upstream checksum validation passed.
No live TypeSafe/OpenRouter API call or live Codex Computer Use connection was tested.

Limits: top-level standard HTML controls; no native desktop, frames, canvas, speech,
file upload or free-text generation. Origin checks do not provide full network isolation.
