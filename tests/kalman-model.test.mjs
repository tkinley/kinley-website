import test from 'node:test';
import assert from 'node:assert/strict';
import { filterObservations, simulateSignal } from '../assets/kalman-model.mjs';

test('prediction and correction match a hand-calculated scalar example', () => {
  const result = filterObservations([2, 3], {
    processVariance: 1, measurementVariance: 2, initialEstimate: 0, initialVariance: 1
  });
  assert.deepEqual(result, [
    { estimate: 1, variance: 1, gain: 0.5 },
    { estimate: 2, variance: 1, gain: 0.5 }
  ]);
});

test('later observations cannot change an earlier estimate', () => {
  const prefix = filterObservations([1, -1, 0.5]);
  assert.deepEqual(filterObservations([1, -1, 0.5, 1000]).slice(0, 3), prefix);
});

test('a less reliable observation receives less weight', () => {
  const precise = filterObservations([10], { measurementVariance: 0.1 })[0];
  const noisy = filterObservations([10], { measurementVariance: 100 })[0];
  assert.ok(precise.gain > noisy.gain);
  assert.ok(precise.estimate > noisy.estimate);
});

test('the same seed reproduces all measurements and estimates', () => {
  assert.deepEqual(simulateSignal(), simulateSignal());
  assert.notDeepEqual(simulateSignal(96, 1606), simulateSignal(96, 1607));
});

test('the displayed simulation has finite uncertainty and less estimation error than raw measurements', () => {
  const samples = simulateSignal();
  let rawError = 0;
  let filteredError = 0;
  for (const sample of samples) {
    assert.ok(Number.isFinite(sample.estimate));
    assert.ok(sample.variance > 0);
    assert.ok(sample.gain > 0 && sample.gain < 1);
    rawError += (sample.observation - sample.truth) ** 2;
    filteredError += (sample.estimate - sample.truth) ** 2;
  }
  // This checks this fixed example, not a guarantee for every realization.
  assert.ok(filteredError < rawError);
});
