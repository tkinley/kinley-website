import { simulateSignal } from './kalman-model.mjs';

const sketch = document.getElementById('kalman-sketch');
if (sketch) {
  const samples = simulateSignal();
  const estimatePath = sketch.querySelector('[data-signal-estimate]');
  const observations = sketch.querySelector('[data-signal-observations]');
  const toggle = sketch.querySelector('[data-signal-toggle]');
  const replay = sketch.querySelector('[data-signal-replay]');
  const status = sketch.querySelector('[data-signal-status]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 4600;
  const values = samples.flatMap((sample) => [sample.observation, sample.estimate]);
  const low = Math.min(...values) - 0.25;
  const high = Math.max(...values) + 0.25;
  const x = (index) => 32 + index / (samples.length - 1) * 592;
  const y = (value) => 124 - (value - low) / (high - low) * 108;

  // Straight segments join the actual posterior estimates. No decorative spline
  // or extra smoothing changes the output of the Kalman filter.
  const segments = samples.map((sample, index) =>
    `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(sample.estimate).toFixed(2)}`);
  const points = samples.map((sample, index) => {
    const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    point.setAttribute('cx', x(index).toFixed(2));
    point.setAttribute('cy', y(sample.observation).toFixed(2));
    point.setAttribute('r', '2.5');
    point.setAttribute('class', 'signal-observation');
    observations.appendChild(point);
    return point;
  });

  let frame = null;
  let elapsed = 0;
  let lastTime = null;
  let visibleCount = -1;
  let playing = false;
  let inView = !('IntersectionObserver' in window);
  let started = false;

  function render(count) {
    if (count === visibleCount) return;
    estimatePath.setAttribute('d', segments.slice(0, count).join(' '));
    points.forEach((point, index) => { point.style.visibility = index < count ? 'visible' : 'hidden'; });
    visibleCount = count;
  }

  function cancelFrame() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
  }

  function updateControls() {
    toggle.hidden = motion.matches || elapsed >= duration;
    toggle.textContent = playing ? 'Pause' : 'Resume';
    replay.hidden = motion.matches;
  }

  function tick(time) {
    frame = null;
    if (lastTime !== null) elapsed = Math.min(duration, elapsed + time - lastTime);
    lastTime = time;
    render(Math.min(samples.length, 1 + Math.floor(elapsed / duration * (samples.length - 1))));
    if (elapsed < duration) {
      frame = window.requestAnimationFrame(tick);
    } else {
      playing = false;
      lastTime = null;
      updateControls();
      status.textContent = 'Kalman filter sketch complete. All 96 simulated observations are shown.';
    }
  }

  function schedule() {
    if (playing && inView && !document.hidden && !motion.matches && frame === null) {
      frame = window.requestAnimationFrame(tick);
    }
  }

  function start() {
    cancelFrame();
    elapsed = 0;
    started = true;
    playing = true;
    render(1);
    status.textContent = 'Showing simulated observations and their Kalman estimate over time.';
    updateControls();
    schedule();
  }

  toggle.addEventListener('click', () => {
    playing = !playing;
    cancelFrame();
    status.textContent = playing ? 'Kalman filter sketch resumed.' : 'Kalman filter sketch paused.';
    updateControls();
    schedule();
  });
  replay.addEventListener('click', start);

  function applyMotionPreference() {
    cancelFrame();
    playing = false;
    elapsed = duration;
    render(samples.length);
    updateControls();
    status.textContent = motion.matches
      ? 'Static Kalman filter sketch. All 96 simulated observations are shown.'
      : 'Kalman filter sketch ready. Replay the simulated observations at any time.';
  }
  motion.addEventListener('change', applyMotionPreference);
  document.addEventListener('visibilitychange', () => { cancelFrame(); schedule(); });
  window.addEventListener('pagehide', cancelFrame);
  window.addEventListener('pageshow', schedule);

  // Render a complete chart first, so even an offscreen or reduced-motion view
  // contains useful content. Animate only once the sketch enters the viewport.
  applyMotionPreference();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      cancelFrame();
      if (inView && !started && !motion.matches) start();
      else schedule();
    }, { threshold: 0.25 });
    observer.observe(sketch);
  } else if (!motion.matches) {
    start();
  }

  window.addEventListener('beforeprint', () => {
    cancelFrame();
    render(samples.length);
  });
  window.addEventListener('afterprint', () => {
    render(elapsed >= duration ? samples.length : 1 + Math.floor(elapsed / duration * (samples.length - 1)));
    schedule();
  });
}
