// Many simultaneous z-tests, then Benjamini–Hochberg.
// Each test draws z ~ N(mu, 1): mu = 0 for a null, mu = EFFECT for a real effect.
// Two-sided p = 2 * (1 - Phi(|z|)). Tests are independent, so BH controls the
// expected false discovery proportion (the FDR) at level q.
// Benjamini & Hochberg (1995), J. R. Stat. Soc. B 57:289-300.
export const TESTS = 100;
export const REAL_EFFECTS = 10;
export const EFFECT = 3;
export const ALPHA = 0.05;
export const Q = 0.05;
export const DEFAULT_SEED = 1234;

export function seededUniform(seed) {
  // Mulberry32, the same generator as the Kalman sketch.
  let state = seed >>> 0;
  return function uniform() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Upper-tail probability 1 - Phi(x) for x >= 0.
// Abramowitz & Stegun 26.2.17, absolute error below 7.5e-8.
function upperTail(x) {
  const t = 1 / (1 + 0.2316419 * x);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * poly;
}

export function normalCdf(z) {
  return z >= 0 ? 1 - upperTail(z) : upperTail(-z);
}

export function twoSidedP(z) {
  return Math.min(1, 2 * upperTail(Math.abs(z)));
}

export function simulateTests({ tests = TESTS, real = REAL_EFFECTS, effect = EFFECT, seed = DEFAULT_SEED } = {}) {
  const uniform = seededUniform(seed);
  const normal = () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
  // Shuffle which positions carry real effects so the grid gives nothing away.
  const order = Array.from({ length: tests }, (_, i) => i);
  for (let i = tests - 1; i > 0; i -= 1) {
    const j = Math.floor(uniform() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const isReal = new Array(tests).fill(false);
  order.slice(0, real).forEach((index) => { isReal[index] = true; });
  return isReal.map((realEffect, id) => {
    const z = (realEffect ? effect : 0) + normal();
    return { id, real: realEffect, z, p: twoSidedP(z) };
  });
}

// Step-up procedure: find the largest rank k with p(k) <= k q / m and
// reject the k smallest p-values. Returns flags aligned with the input.
export function benjaminiHochberg(pValues, q = Q) {
  const m = pValues.length;
  const ranked = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p || a.index - b.index);
  let k = 0;
  ranked.forEach((entry, i) => { if (entry.p <= (i + 1) * q / m) k = i + 1; });
  const rejected = new Array(m).fill(false);
  ranked.slice(0, k).forEach((entry) => { rejected[entry.index] = true; });
  const rank = new Array(m);
  ranked.forEach((entry, i) => { rank[entry.index] = i + 1; });
  return { k, rejected, rank, cutoff: k ? ranked[k - 1].p : 0 };
}

export function summarize(tests, flagged) {
  let discoveries = 0;
  let falseDiscoveries = 0;
  let found = 0;
  tests.forEach((test, i) => {
    if (!flagged[i]) return;
    discoveries += 1;
    if (test.real) found += 1; else falseDiscoveries += 1;
  });
  const real = tests.filter((test) => test.real).length;
  return {
    discoveries,
    falseDiscoveries,
    // Realized false discovery proportion in this one draw. Its expectation is the FDR.
    fdp: discoveries ? falseDiscoveries / discoveries : 0,
    power: real ? found / real : 0
  };
}

export function analyze(options = {}) {
  const tests = simulateTests(options);
  const alpha = options.alpha ?? ALPHA;
  const q = options.q ?? Q;
  const raw = tests.map((test) => test.p < alpha);
  const bh = benjaminiHochberg(tests.map((test) => test.p), q);
  return { tests, raw, bh, rawSummary: summarize(tests, raw), bhSummary: summarize(tests, bh.rejected) };
}
