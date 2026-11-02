import test from 'node:test';
import assert from 'node:assert/strict';
import {patientBridge,earningsReview,REVIEW_INPUTS} from '../assets/iova-review-tools.mjs';
test('patient bridge distinguishes revenue equivalents from pool and capacity constraints',()=>{
  const [base]=patientBridge();assert.equal(base.infusions,1680);assert.equal(base.poolPercent,21);assert.equal(base.perCenter,16.8);assert.equal(base.capacityPercent,33.6);
  assert.equal(patientBridge({...REVIEW_INPUTS,netRevenue:250000})[0].infusions,3360);
  assert.throws(()=>patientBridge({...REVIEW_INPUTS,netRevenue:0}),RangeError);
  assert.throws(()=>patientBridge({...REVIEW_INPUTS,amtMix:101}),RangeError);
});
test('earnings update uses remaining guidance arithmetic rather than equating an average with a quarterly promise',()=>{
  const r=earningsReview(122.5);assert.ok(Math.abs(r.q4Low-116.757)<1e-10);assert.ok(Math.abs(r.q4High-126.757)<1e-10);assert.equal(r.comparison,'within');
  assert.equal(earningsReview(110).comparison,'below');assert.equal(earningsReview(130).comparison,'above');assert.throws(()=>earningsReview(-1),RangeError);
});
