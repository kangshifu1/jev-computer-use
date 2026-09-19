import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSamples,totalTimeMs} from '../scripts/benchmark-session.mjs';
test('benchmark keeps failures visible and missing successful timings null',()=>{
  const result=summarizeSamples([
    {controller:'jev',verified:true,setupMs:50,loopAndVerificationMs:300},
    {controller:'jev',verified:false,loopAndVerificationMs:1},
    {controller:'jev',verified:true,setupMs:150,loopAndVerificationMs:100},
    {controller:'codex-session',verified:false,loopAndVerificationMs:10}
  ]);
  assert.equal(result.jev.attempts,3);
  assert.equal(result.jev.verified,2);
  assert.equal(result.jev.medianLoopAndVerificationMs,200);
  assert.equal(result.jev.medianTotalMs,300);
  assert.equal(result['codex-session'].medianLoopAndVerificationMs,null);
  assert.equal(result['codex-session'].medianTotalMs,null);
  assert.throws(()=>summarizeSamples([{controller:'jev',verified:true,loopAndVerificationMs:NaN}]));
});
test('total median is calculated from paired trials, not summed stage medians',()=>{
  const samples=[
    {controller:'jev',verified:true,setupMs:100,loopAndVerificationMs:300},
    {controller:'jev',verified:true,setupMs:1000,loopAndVerificationMs:100},
    {controller:'jev',verified:true,setupMs:0,loopAndVerificationMs:500}
  ];
  const result=summarizeSamples(samples).jev;
  assert.equal(result.medianTotalMs,500);
  assert.notEqual(result.medianTotalMs,100+result.medianLoopAndVerificationMs);
  assert.equal(totalTimeMs({setupMs:2904.93,loopAndVerificationMs:2211.99}),5116.92);
  assert.throws(()=>totalTimeMs({loopAndVerificationMs:100}));
});
