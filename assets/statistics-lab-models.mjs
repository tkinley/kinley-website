// Pure teaching models; all inputs describe hypothetical examples.
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
export function random(seed = 1) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function normalCDF(z) {
  if (z === 0) return 0.5;
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t*Math.exp(-x*x);
  return 0.5 * (1 + Math.sign(z) * erf);
}
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('Probability must be between zero and one.');
  let lo = -9, hi = 9;
  for (let i = 0; i < 65; i++) { const mid = (lo + hi) / 2; if (normalCDF(mid) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function wilson(x, n, confidence = 0.95) {
  if (!(n > 0 && x >= 0 && x <= n && confidence > 0 && confidence < 1)) throw new RangeError('Invalid binomial observations.');
  const z = normalQuantile((1 + confidence) / 2), p = x/n, d = 1 + z*z/n;
  const center = (p + z*z/(2*n))/d, half = z*Math.sqrt(p*(1-p)/n + z*z/(4*n*n))/d;
  return [clamp(center-half, 0, 1), clamp(center+half, 0, 1)];
}
export function logGamma(z) {
  const c = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI*z)) - logGamma(1-z);
  z -= 1;
  let x = 0.9999999999998099;
  c.forEach((v, i) => { x += v / (z+i+1); });
  const t = z + 7.5;
  return 0.5*Math.log(2*Math.PI) + (z+0.5)*Math.log(t) - t + Math.log(x);
}
const logBeta = (a, b) => logGamma(a) + logGamma(b) - logGamma(a+b);
export function binomialPMF(n, p) {
  if (!Number.isInteger(n) || n < 0 || p < 0 || p > 1) throw new RangeError('Invalid binomial parameters.');
  if (p === 0 || p === 1) return Array.from({length:n+1}, (_, k) => +(k === (p === 0 ? 0 : n)));
  return Array.from({length:n+1}, (_, k) => Math.exp(logGamma(n+1)-logGamma(k+1)-logGamma(n-k+1)+k*Math.log(p)+(n-k)*Math.log1p(-p)));
}
export function betaBinomialPMF(n, a, b) {
  return Array.from({length:n+1}, (_, k) => Math.exp(logGamma(n+1)-logGamma(k+1)-logGamma(n-k+1)+logBeta(k+a,n-k+b)-logBeta(a,b)));
}
export function discreteQuantile(pmf, q) {
  let cumulative = 0;
  for (let k = 0; k < pmf.length; k++) { cumulative += pmf[k]; if (cumulative >= q) return k; }
  return pmf.length-1;
}
export const countInterval = pmf => [discreteQuantile(pmf, 0.025), discreteQuantile(pmf, 0.975)];
export const betaDensity = (p, a, b) => Math.exp((a-1)*Math.log(p)+(b-1)*Math.log1p(-p)-logBeta(a,b));
function betaFraction(a, b, x) {
  const tiny = 1e-300;
  let c = 1, d = 1-(a+b)*x/(a+1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1/d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2*m;
    let aa = m*(b-m)*x/((a-1+m2)*(a+m2));
    d = 1+aa*d; if (Math.abs(d) < tiny) d = tiny;
    c = 1+aa/c; if (Math.abs(c) < tiny) c = tiny;
    d = 1/d; h *= d*c;
    aa = -(a+m)*(a+b+m)*x/((a+m2)*(a+1+m2));
    d = 1+aa*d; if (Math.abs(d) < tiny) d = tiny;
    c = 1+aa/c; if (Math.abs(c) < tiny) c = tiny;
    d = 1/d;
    const delta = d*c; h *= delta;
    if (Math.abs(delta-1) < 3e-14) break;
  }
  return h;
}
export function betaCDF(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a*Math.log(x)+b*Math.log1p(-x)-logBeta(a,b));
  return clamp(x < (a+1)/(a+b+2) ? front*betaFraction(a,b,x)/a : 1-front*betaFraction(b,a,1-x)/b, 0, 1);
}
export function betaQuantile(q, a, b) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 65; i++) { const mid = (lo+hi)/2; if (betaCDF(mid,a,b) < q) lo = mid; else hi = mid; }
  return (lo+hi)/2;
}
export function trialBalance(n, method = 'random', seed = 7) {
  const patients = Array.from({length:2*n}, (_, i) => +(i < Math.round(0.4*2*n)));
  if (method === 'random') {
    const rng = random(seed);
    for (let i = patients.length-1; i > 0; i--) { const j = Math.floor(rng()*(i+1)); [patients[i],patients[j]] = [patients[j],patients[i]]; }
  } else patients.sort((a,b) => a-b);
  return [mean(patients.slice(0,n)), mean(patients.slice(n))];
}
export function endpointRates(month) {
  const response = [2,3,4,5,6,8,10,Infinity,Infinity,Infinity,Infinity,Infinity];
  const progression = [7,10,16,20,Infinity,Infinity,Infinity,4,8,12,18,Infinity];
  const death = [12,18,Infinity,Infinity,Infinity,Infinity,Infinity,9,14,Infinity,22,Infinity];
  return [response.filter(t=>t<=month).length/12, progression.filter((t,i)=>Math.min(t,death[i])>month).length/12, death.filter(t=>t>month).length/12];
}
export function power(n, delta, alpha = 0.05, control = 0.30) {
  const treatment = control+delta, pooled = (treatment+control)/2;
  const nullSE = Math.sqrt(2*pooled*(1-pooled)/n), altSE = Math.sqrt((treatment*(1-treatment)+control*(1-control))/n);
  const critical = normalQuantile(1-alpha/2)*nullSE;
  return clamp(1-normalCDF((critical-delta)/altSE)+normalCDF((-critical-delta)/altSE),0,1);
}
export function familyError(m, alpha) {
  return [1-(1-alpha)**m, 1-(1-alpha/m)**m];
}
export function selectedRate(groups, n, repetitions = 600) {
  const rng = random(41031);
  let fixed = 0, best = 0;
  for (let r = 0; r < repetitions; r++) {
    const counts = Array.from({length:groups}, () => { let x=0; for (let i=0;i<n;i++) x += +(rng()<0.30); return x/n; });
    fixed += counts[0]; best += Math.max(...counts);
  }
  return [fixed/repetitions, best/repetitions];
}
export function kaplanMeier(records) {
  const times = [...new Set(records.map(r=>r.time))].sort((a,b)=>a-b);
  const curve = [{x:0,y:1}], censorMarks = [], riskSets = [];
  let atRisk = records.length, survival = 1, median = null;
  for (const time of times) {
    const events = records.filter(r=>r.time===time&&r.event).length;
    const censored = records.filter(r=>r.time===time&&!r.event).length;
    riskSets.push({time,atRisk,events,censored});
    curve.push({x:time,y:survival});
    if (events) { survival *= 1-events/atRisk; curve.push({x:time,y:survival}); if (median===null&&survival<=0.5) median=time; }
    if (censored) censorMarks.push({x:time,y:survival});
    atRisk -= events+censored;
  }
  return {curve,censorMarks,riskSets,median,survival};
}
export function missingRates(missing, assumedRate) {
  const observed = 100-missing, responders = Math.round(0.5*observed);
  return [responders/observed, (responders+missing*assumedRate)/100];
}
export function noninferiority(effect, halfWidth, margin) {
  const lo = effect-halfWidth, hi = effect+halfWidth;
  return {lo,hi,noninferior:lo>-margin,superior:lo>0};
}
export function interimLooks(looks, z) {
  const critical = normalQuantile(1-0.05/(2*looks));
  const points = Array.from({length:looks}, (_,i)=>({x:i+1,y:i===looks-1?z:Math.max(0,z*Math.sqrt((i+1)/looks)+0.1*Math.sin((i+1)*2))}));
  return {critical,points,crossed:points.some(p=>p.y>=critical),nominalP:2*(1-normalCDF(z))};
}
export const zeroEventBound = n => 1-Math.pow(0.05,1/n);
