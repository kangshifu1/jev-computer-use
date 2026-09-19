import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTask, summarize, checkAssertions } from '../skills/jev-computer-use/scripts/contracts.mjs';
import { availableActions, discoverActions } from '../skills/jev-computer-use/bridge.mjs';

const task = () => ({ goal: 'Open reports', startUrl: 'https://example.com/', allowedOrigins: ['https://example.com'], controls: [{op:'click',name:'Reports'}], assertions: [{type:'text-present',value:'Daily report'}] });
test('task rejects out-of-scope origins, credentials and unrestricted actions', () => {
  assert.ok(validateTask(task()));
  for (const patch of [{startUrl:'https://elsewhere.test/'},{startUrl:'https://user:pass@example.com/'},{policy:{click:true}},{controls:[{op:'type',text:'hello'}]},{controls:[{op:'click'}]},{controls:[{op:'scroll',direction:'down',point:[1,2]}]},{assertions:[]},{maxSteps:100},{minConfidence:0.1}]) assert.throws(() => validateTask({...task(),...patch}));
});
test('duplicate names and text fields are never resolved as named clicks', () => {
  assert.deepEqual(availableActions('1 button Reports\n2 button Reports', [{op:'click',name:'Reports'}]), []);
  assert.deepEqual(availableActions('1 text field Reports', [{op:'click',name:'Reports'}]), []);
  const actions = discoverActions('1 button Buy\n2 button Reports', {click:true,requireCodexNames:[/Buy/]});
  assert.deepEqual(actions.map(a=>a.name), ['Reports']);
});
test('model completion only becomes verified after nonempty passing assertions', () => {
  const outcome = {status:'needs_verification',history:[],elapsedMs:1};
  assert.equal(summarize(outcome, []).verified, false);
  assert.equal(summarize(outcome, [{status:'not-covered'}]).verified, false);
  assert.equal(summarize(outcome, [{status:'fail'}]).status, 'verification-failed');
  assert.equal(summarize(outcome, [{status:'pass'}]).verified, true);
  assert.equal(summarize({...outcome,status:'step_limit'}, [{status:'pass'}]).verified, false);
});
test('independent text and URL assertions distinguish failure and unsupported coverage', () => {
  const results = checkAssertions([{type:'text-present',value:'Daily'},{type:'text-absent',value:'Error'},{type:'url-equals',value:'https://example.com/reports'},{type:'pixel',value:'blue'}], {text:'Daily Error',url:'https://example.com/'});
  assert.deepEqual(results.map(r=>r.status), ['pass','fail','fail','not-covered']);
});
