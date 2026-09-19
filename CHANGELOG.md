# Changelog

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
