import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSamples} from '../scripts/benchmark-session.mjs';
test('benchmark keeps failures visible and missing successful timings null',()=>{
  const result=summarizeSamples([
    {controller:'jev',verified:true,loopAndVerificationMs:300},
    {controller:'jev',verified:false,loopAndVerificationMs:1},
    {controller:'jev',verified:true,loopAndVerificationMs:100},
    {controller:'codex-session',verified:false,loopAndVerificationMs:10}
  ]);
  assert.equal(result.jev.attempts,3);
  assert.equal(result.jev.verified,2);
  assert.equal(result.jev.medianLoopAndVerificationMs,200);
  assert.equal(result['codex-session'].medianLoopAndVerificationMs,null);
  assert.throws(()=>summarizeSamples([{controller:'jev',verified:true,loopAndVerificationMs:NaN}]));
});
