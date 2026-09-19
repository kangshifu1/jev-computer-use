// Stable entry point for hosts that already expose a compatible Codex tab API.
export { createSession, run, loadConfig, availableActions, discoverActions,
  waitForState, decide } from './vendor/jev-browser-use/bridge.mjs';
