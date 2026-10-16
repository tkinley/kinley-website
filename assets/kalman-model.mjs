// Scalar random-walk model: x[t] = x[t-1] + w[t], z[t] = x[t] + v[t].
// w ~ N(0, Q) and v ~ N(0, R), independently. A = H = 1; no control input.
// Predict/correct equations: Welch & Bishop, An Introduction to the Kalman Filter,
// https://www.cs.unc.edu/~welch/media/pdf/kalman_intro.pdf, Tables 1-1 and 1-2.
export const PROCESS_VARIANCE = 0.012;
export const MEASUREMENT_VARIANCE = 0.36;

export function filterObservations(observations, {
  processVariance = PROCESS_VARIANCE,
  measurementVariance = MEASUREMENT_VARIANCE,
  initialEstimate = 0,
  initialVariance = 1
} = {}) {
  let estimate = initialEstimate;
  let variance = initialVariance;

  return observations.map((observation) => {
    // Predict: the state stays at the previous estimate; uncertainty increases.
    const predictedVariance = variance + processVariance;
    // Correct: balance the new measurement against prediction uncertainty.
    const gain = predictedVariance / (predictedVariance + measurementVariance);
    estimate += gain * (observation - estimate);
    variance = (1 - gain) * predictedVariance;
    return { estimate, variance, gain };
  });
}

export function simulateSignal(count = 96, seed = 1606) {
  // Seeded Mulberry32 and Box–Muller: every replay uses the same Gaussian noise.
  let state = seed >>> 0;
  function uniform() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  function normal() {
    return Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
  }

  let truth = 0;
  const samples = Array.from({ length: count }, (_, time) => {
    truth += Math.sqrt(PROCESS_VARIANCE) * normal();
    return { time, truth, observation: truth + Math.sqrt(MEASUREMENT_VARIANCE) * normal() };
  });
  const filtered = filterObservations(samples.map((sample) => sample.observation));
  return samples.map((sample, index) => ({ ...sample, ...filtered[index] }));
}

// Root-mean-square distance between two equal-length series.
export function rmse(a, b) {
  return Math.sqrt(a.reduce((total, value, i) => total + (value - b[i]) ** 2, 0) / a.length);
}

// Re-run the filter on the same observations with a different assumed
// measurement variance R. The truth and the observations stay fixed.
export function refilter(samples, measurementVariance) {
  const filtered = filterObservations(samples.map((sample) => sample.observation), { measurementVariance });
  return samples.map((sample, index) => ({ ...sample, ...filtered[index] }));
}
