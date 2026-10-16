import test from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, twoSidedP, simulateTests, benjaminiHochberg, summarize, analyze, TESTS, REAL_EFFECTS } from '../assets/fdr-model.mjs';

test('normal tail matches reference values', () => {
  assert.ok(Math.abs(normalCdf(1.96) - 0.9750021) < 1e-6);
  assert.ok(Math.abs(normalCdf(-1) - 0.1586553) < 1e-6);
  assert.ok(Math.abs(twoSidedP(1.96) - 0.0499958) < 1e-6);
  assert.ok(Math.abs(twoSidedP(0) - 1) < 1e-8);
});

test('BH is a step-up procedure: a later pass rescues an earlier miss', () => {
  // Thresholds for m = 3, q = 0.05: 0.0167, 0.0333, 0.05.
  const { k, rejected } = benjaminiHochberg([0.02, 0.025, 0.03], 0.05);
  assert.equal(k, 3);
  assert.deepEqual(rejected, [true, true, true]);
});

test('BH matches a hand-worked example and keeps input order', () => {
  const { k, rejected, rank } = benjaminiHochberg([0.2, 0.001, 0.04, 0.012, 0.03], 0.05);
  assert.equal(k, 4);
  assert.deepEqual(rejected, [false, true, true, true, true]);
  assert.deepEqual(rank, [5, 1, 4, 2, 3]);
});

test('BH rejects nothing when no p-value clears its threshold', () => {
  assert.equal(benjaminiHochberg([0.5, 0.2, 0.9], 0.05).k, 0);
});

test('simulation is reproducible and has the stated design', () => {
  const tests = simulateTests({ seed: 7 });
  assert.deepEqual(tests, simulateTests({ seed: 7 }));
  assert.notDeepEqual(tests, simulateTests({ seed: 8 }));
  assert.equal(tests.length, TESTS);
  assert.equal(tests.filter((t) => t.real).length, REAL_EFFECTS);
  assert.ok(tests.every((t) => t.p > 0 && t.p <= 1));
});

test('with q = alpha, BH discoveries are a subset of p < alpha discoveries', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const { raw, bh } = analyze({ seed });
    bh.rejected.forEach((flag, i) => { if (flag) assert.ok(raw[i]); });
  }
});

test('averaged over many draws, BH keeps the false discovery proportion near (m0/m) q', () => {
  let total = 0;
  const draws = 1500;
  for (let seed = 1; seed <= draws; seed += 1) total += analyze({ seed }).bhSummary.fdp;
  const fdr = total / draws;
  // Independent tests: FDR = (90/100) * 0.05 = 0.045. Allow Monte Carlo error.
  assert.ok(fdr < 0.06, `estimated FDR ${fdr}`);
});

test('summary counts discoveries, noise, and power', () => {
  const tests = [{ real: true }, { real: false }, { real: true }, { real: false }];
  assert.deepEqual(summarize(tests, [true, true, false, false]), { discoveries: 2, falseDiscoveries: 1, fdp: 0.5, power: 0.5 });
});
