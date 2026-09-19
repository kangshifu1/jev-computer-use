export function validateTask(task) {
  if (!task || typeof task.goal !== 'string' || !task.goal.trim()) throw new Error('Task needs a goal');
  if (!Array.isArray(task.allowedOrigins) || !task.allowedOrigins.length) throw new Error('Task needs allowedOrigins');
  for (const origin of task.allowedOrigins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('Origins must be exact HTTP(S) origins');
  }
  const start = new URL(task.startUrl);
  if (start.username || start.password || !task.allowedOrigins.includes(start.origin)) throw new Error('startUrl is outside allowedOrigins or contains credentials');
  if (!Array.isArray(task.controls) || !task.controls.length) throw new Error('Standalone tasks need explicit controls');
  if (task.controls.some(c => !c || !['click', 'scroll', 'reload'].includes(c.op))) throw new Error('Only explicit clicks, scrolling and reloads are supported');
  for (const c of task.controls) {
    if (c.op === 'click' && (typeof c.name !== 'string' || !c.name.trim())) throw new Error('Task needs a name for every click');
    if (c.op === 'scroll' && (!['up','down'].includes(c.direction) || !Number.isInteger(c.amount ?? 1) || (c.amount ?? 1) < 1 || (c.amount ?? 1) > 5 || c.targetName || c.point)) throw new Error('Only explicit bounded page scrolling is supported');
  }
  if (!Number.isInteger(task.maxSteps ?? 10) || (task.maxSteps ?? 10) < 1 || (task.maxSteps ?? 10) > 30) throw new Error('Task needs maxSteps between 1 and 30');
  if (!Number.isFinite(task.maxMs ?? 45000) || (task.maxMs ?? 45000) < 1 || (task.maxMs ?? 45000) > 45000) throw new Error('Task needs maxMs between 1 and 45000');
  if (!Number.isFinite(task.minConfidence ?? 0.55) || (task.minConfidence ?? 0.55) < 0.55 || (task.minConfidence ?? 0.55) > 1) throw new Error('Task needs minConfidence between 0.55 and 1');
  if (task.policy) throw new Error('Standalone tasks use explicit controls, not auto-discovery policies');
  if (!Array.isArray(task.assertions) || !task.assertions.length) throw new Error('Task needs independent assertions');
  for (const a of task.assertions) {
    if (!a || !['text-present', 'text-absent', 'url-equals'].includes(a.type) || typeof a.value !== 'string' || !a.value.trim()) throw new Error('Unsupported assertion');
    if (a.type === 'url-equals' && !task.allowedOrigins.includes(new URL(a.value).origin)) throw new Error('Assertion URL outside allowedOrigins');
  }
  return task;
}

export function checkAssertions(assertions, { text, url }) {
  return assertions.map(a => {
    let pass;
    if (a.type === 'text-present') pass = text.includes(a.value);
    else if (a.type === 'text-absent') pass = !text.includes(a.value);
    else if (a.type === 'url-equals') pass = url === a.value;
    else return { ...a, status: 'not-covered' };
    return { ...a, status: pass ? 'pass' : 'fail' };
  });
}

export function summarize(outcome, assertions) {
  // Reaching the target is not equivalent to having verified the target.
  const verified = outcome.status === 'needs_verification' && assertions.length > 0 && assertions.every(a => a.status === 'pass');
  return { status: verified ? 'verified' : outcome.status === 'needs_verification' ? 'verification-failed' : outcome.status,
    verified, assertions, decisions: outcome.history.length,
    executedActions: outcome.history.filter(h => h.executed).length, elapsedMs: outcome.elapsedMs };
}
