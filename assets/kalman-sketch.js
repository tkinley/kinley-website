import { simulateSignal, refilter, rmse, MEASUREMENT_VARIANCE } from './kalman-model.mjs?v=4';

const root = document.getElementById('kalman-sketch');
if (root) initKalman(root);

function initKalman(root) {
  const $ = (selector) => root.querySelector(selector);
  const plot = $('[data-k-plot]');
  const band = $('[data-k-band]');
  const truth = $('[data-k-truth]');
  const line = $('[data-k-line]');
  const dotsLayer = $('[data-k-obs]');
  const innovation = $('[data-k-innov]');
  const guide = $('[data-k-guide]');
  const crossPos = $('[data-k-cross-pos]');
  const cross = $('[data-k-cross]');
  const hud = { t: $('[data-k-t]'), gain: $('[data-k-gain]'), est: $('[data-k-est]'), sd: $('[data-k-sd]') };
  const toggle = $('[data-k-toggle]');
  const replay = $('[data-k-replay]');
  const status = $('[data-k-status]');
  const knob = $('[data-k-knob]');
  const knobOut = $('[data-k-knob-out]');
  const errorOut = $('[data-k-error]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const base = simulateSignal();
  const n = base.length;
  let samples = base;

  // Plot geometry in SVG user units.
  const X0 = 28, X1 = 584, Y0 = 18, Y1 = 280;
  const values = base.flatMap((s) => [s.observation, s.truth]);
  const low = Math.min(...values) - 0.35;
  const high = Math.max(...values) + 0.35;
  const x = (i) => X0 + i / (n - 1) * (X1 - X0);
  const y = (v) => Y1 - (v - low) / (high - low) * (Y1 - Y0);
  const fmt = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const half = (s) => 1.96 * Math.sqrt(s.variance);
  const prior = (i) => (i === 0 ? 0 : samples[i - 1].estimate);

  const small = window.matchMedia('(max-width: 600px)');
  const dots = base.map((s, i) => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x(i).toFixed(2));
    dot.setAttribute('cy', y(s.observation).toFixed(2));
    dot.setAttribute('r', small.matches ? '4.2' : '2.6');
    dot.setAttribute('class', 'k-obs');
    dotsLayer.appendChild(dot);
    return dot;
  });
  small.addEventListener('change', () => dots.forEach((dot) => dot.setAttribute('r', small.matches ? '4.2' : '2.6')));
  truth.setAttribute('d', base.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(s.truth).toFixed(2)}`).join(''));

  const DURATION = 7200;
  let head = n - 1;          // fractional position of the estimate's leading edge
  let shown = n;             // observations drawn so far
  let elapsed = DURATION;
  let playing = false;
  let started = false;
  let inView = !('IntersectionObserver' in window);
  let frame = null;
  let last = null;
  let scrubbing = false;

  function point(f) {
    const i = Math.floor(f);
    const u = f - i;
    if (u === 0 || i >= n - 1) return { x: x(i), est: samples[i].estimate, half: half(samples[i]) };
    const a = samples[i], b = samples[i + 1];
    return { x: x(i + u), est: a.estimate + (b.estimate - a.estimate) * u, half: half(a) + (half(b) - half(a)) * u };
  }

  function draw(f) {
    const i = Math.floor(f);
    const pts = [];
    for (let k = 0; k <= i; k += 1) pts.push({ x: x(k), est: samples[k].estimate, half: half(samples[k]) });
    if (f > i) pts.push(point(f));
    line.setAttribute('d', pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)},${y(p.est).toFixed(2)}`).join(''));
    const upper = pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)},${y(p.est + p.half).toFixed(2)}`).join('');
    const lower = pts.slice().reverse().map((p) => `L${p.x.toFixed(2)},${y(p.est - p.half).toFixed(2)}`).join('');
    band.setAttribute('d', `${upper}${lower}Z`);

    // The newest observation arrives as the edge leaves the previous time step.
    const latest = f > i ? i + 1 : i;
    const count = latest + 1;
    if (count !== shown) {
      dots.forEach((dot, k) => {
        const visible = k < count;
        dot.style.visibility = visible ? 'visible' : 'hidden';
        if (visible && k >= shown && k === latest && !motion.matches) {
          dot.classList.remove('pop'); void dot.getBBox(); dot.classList.add('pop');
        }
      });
      shown = count;
    }
    // Innovation: the gap between what the filter expected and what it saw.
    const fade = f > i ? 1 - (f - i) : 0;
    innovation.setAttribute('x1', x(latest).toFixed(2));
    innovation.setAttribute('x2', x(latest).toFixed(2));
    innovation.setAttribute('y1', y(prior(latest)).toFixed(2));
    innovation.setAttribute('y2', y(samples[latest].observation).toFixed(2));
    innovation.style.opacity = String(fade * 0.9);

    const tip = point(f);
    crossPos.setAttribute('transform', `translate(${tip.x.toFixed(2)} ${y(tip.est).toFixed(2)})`);
    readout(latest);
  }

  function readout(i) {
    const s = samples[i];
    hud.t.textContent = String(i + 1);
    hud.gain.textContent = s.gain.toFixed(3);
    hud.est.textContent = fmt(s.estimate);
    hud.sd.textContent = half(s).toFixed(2);
  }

  function finish() {
    playing = false;
    elapsed = DURATION;
    head = n - 1;
    draw(head);
    truth.classList.add('shown');
    if (!motion.matches) { cross.classList.remove('locked'); void cross.getBBox(); cross.classList.add('locked'); }
    updateControls();
  }

  function updateControls() {
    toggle.hidden = motion.matches || elapsed >= DURATION || !started;
    toggle.textContent = playing ? 'Pause' : 'Resume';
    replay.hidden = motion.matches || !started;
  }

  function cancel() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    last = null;
  }

  function tick(time) {
    frame = null;
    if (last !== null) elapsed = Math.min(DURATION, elapsed + time - last);
    last = time;
    const k = elapsed / DURATION;
    head = (1 - Math.pow(1 - k, 1.6)) * (n - 1) * 0.15 + k * (n - 1) * 0.85;
    draw(Math.min(n - 1, head));
    if (elapsed < DURATION) frame = window.requestAnimationFrame(tick);
    else { finish(); status.textContent = `Kalman sketch complete. All ${n} simulated observations are shown, with the true signal revealed.`; }
  }

  function schedule() {
    if (playing && inView && !document.hidden && !motion.matches && frame === null) frame = window.requestAnimationFrame(tick);
  }

  function start() {
    cancel();
    root.classList.remove('is-armed');
    started = true;
    playing = true;
    elapsed = 0;
    head = 0;
    shown = 0;
    truth.classList.remove('shown');
    draw(0);
    status.textContent = 'Showing simulated observations arriving one at a time, and the Kalman estimate with its 95% band.';
    updateControls();
    schedule();
  }

  toggle.addEventListener('click', () => {
    playing = !playing;
    cancel();
    status.textContent = playing ? 'Kalman sketch resumed.' : 'Kalman sketch paused.';
    updateControls();
    schedule();
  });
  replay.addEventListener('click', start);

  // Knob: the filter's assumed measurement variance R, on a log scale.
  function describeKnob() {
    const power = Number(knob.value);
    const r = MEASUREMENT_VARIANCE * 10 ** power;
    let mood = 'the true value';
    if (power <= -0.75) mood = 'chases every measurement';
    else if (power < -0.2) mood = 'a little twitchy';
    else if (power >= 1.4) mood = 'barely listens';
    else if (power > 0.2) mood = 'a little stubborn';
    knobOut.textContent = `R = ${r < 0.1 ? r.toFixed(3) : r.toFixed(2)}, ${mood}`;
    const err = rmse(samples.map((s) => s.estimate), samples.map((s) => s.truth));
    const raw = rmse(samples.map((s) => s.observation), samples.map((s) => s.truth));
    errorOut.innerHTML = `Error vs. truth <b>${err.toFixed(2)}</b> · raw measurements ${raw.toFixed(2)}`;
  }
  knob.addEventListener('input', () => {
    const r = MEASUREMENT_VARIANCE * 10 ** Number(knob.value);
    samples = Math.abs(Number(knob.value)) < 1e-9 ? base : refilter(base, r);
    cancel();
    finish();
    describeKnob();
  });

  // Scrub along the time axis once the sketch is not animating.
  function scrub(event) {
    if (playing) return;
    const box = plot.getBoundingClientRect();
    const ux = (event.clientX - box.left) / box.width * 600;  // viewBox width
    const i = Math.max(0, Math.min(n - 1, Math.round((ux - X0) / (X1 - X0) * (n - 1))));
    scrubbing = true;
    root.classList.add('scrubbing');
    guide.setAttribute('x1', x(i).toFixed(2));
    guide.setAttribute('x2', x(i).toFixed(2));
    crossPos.setAttribute('transform', `translate(${x(i).toFixed(2)} ${y(samples[i].estimate).toFixed(2)})`);
    readout(i);
  }
  plot.addEventListener('pointermove', scrub);
  plot.addEventListener('pointerleave', () => {
    if (!scrubbing) return;
    scrubbing = false;
    root.classList.remove('scrubbing');
    if (!playing) draw(head);
  });

  function applyMotion() {
    cancel();
    if (motion.matches) {
      root.classList.remove('is-armed');
      started = false;
      finish();
      status.textContent = `Static Kalman sketch. All ${n} simulated observations are shown.`;
    } else {
      finish();
    }
    updateControls();
  }
  motion.addEventListener('change', applyMotion);
  document.addEventListener('visibilitychange', () => { cancel(); schedule(); });
  window.addEventListener('pagehide', cancel);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('beforeprint', () => { cancel(); draw(n - 1); truth.classList.add('shown'); });

  // A complete chart is always rendered first. With motion allowed, it waits
  // hidden until it scrolls into view, then draws itself once.
  applyMotion();
  describeKnob();
  if (!motion.matches && 'IntersectionObserver' in window) {
    root.classList.add('is-armed');
    // Start once half of the plot itself is on screen. Until then the finished
    // chart shows as a faint preview, never an empty frame.
    new IntersectionObserver((entries) => {
      const entry = entries[0];
      inView = entry.isIntersecting;
      cancel();
      if (inView && entry.intersectionRatio >= 0.45 && !started && !motion.matches) start(); else schedule();
    }, { threshold: [0, 0.5] }).observe(plot);
  } else if (!motion.matches) {
    start();
  }
}
