import { analyze, DEFAULT_SEED, ALPHA, Q } from './fdr-model.mjs';

const root = document.getElementById('fdr-sketch');
if (root) initFdr(root);

function initFdr(root) {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (selector) => root.querySelector(selector);
  const stage = $('[data-f-stage]');
  const layer = $('[data-f-dots]');
  const bhPath = $('[data-f-bh]');
  const scan = $('[data-f-scan]');
  const cut = $('[data-f-cut]');
  const cutLabel = $('[data-f-cut-label]');
  const feed = $('[data-f-feed]');
  const narration = $('[data-f-narration]');
  const desc = $('[data-f-desc]');
  const seedOut = $('[data-f-seed]');
  const toggle = $('[data-f-toggle]');
  const replay = $('[data-f-replay]');
  const fresh = $('[data-f-new]');
  const steps = Array.from(root.querySelectorAll('[data-f-step]'));
  const board = {
    rawN: $('[data-f-raw-n]'), rawF: $('[data-f-raw-f]'), rawFdp: $('[data-f-raw-fdp]'),
    bhN: $('[data-f-bh-n]'), bhF: $('[data-f-bh-f]'), bhFdp: $('[data-f-bh-fdp]')
  };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const small = window.matchMedia('(max-width: 600px)');
  small.addEventListener('change', () => layer.querySelectorAll('circle').forEach((c) => c.setAttribute('r', small.matches ? '8.5' : '6')));

  // Geometry in SVG user units (viewBox 600 x 280).
  const COLS = 20;
  const gridPos = (id) => ({ x: 39 + (id % COLS) * 27.5, y: 58 + Math.floor(id / COLS) * 40 });
  const PX0 = 50, PX1 = 584, PY0 = 18, PY1 = 240, YMAX = 6;
  const rankX = (rank, m) => PX0 + (rank - 1) / (m - 1) * (PX1 - PX0);
  const height = (p) => Math.min(YMAX, -Math.log10(p));
  const rankY = (p) => PY1 - height(p) / YMAX * (PY1 - PY0);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pct = (v) => `${Math.round(v * 100)}%`;
  const pFmt = (p) => (p < 0.001 ? p.toExponential(0).replace('e-', 'e−') : p.toFixed(3).replace(/^0/, ''));

  // Autoplay schedule (ms from start) for phases 1..5, and when the run ends.
  const PHASE_AT = [0, 2400, 5000, 8000, 10600];
  const END_AT = 15000;

  let seed = DEFAULT_SEED;
  let data = null;
  let dots = [];
  let dropped = [];
  let phase = 0;
  let clock = 0;
  let playing = false;
  let started = false;
  let inView = !('IntersectionObserver' in window);
  let frame = null;
  let last = null;
  let tween = null;   // { start, duration, from: [], to: [] } in real time
  let sweep = null;   // { start, duration, fromX, toX, queue: [] }
  let popTimer = null;

  function build() {
    data = analyze({ seed });
    const m = data.tests.length;
    layer.textContent = '';
    dots = data.tests.map((test, i) => {
      const g = document.createElementNS(NS, 'g');
      const hit = data.raw[i];
      const kept = data.bh.rejected[i];
      g.setAttribute('class', `t ${test.real ? 'real' : 'null'}${hit ? ' hit' : ''}${kept ? ' bh' : ''}`);
      g.style.setProperty('--d', `${(i % COLS) * 22 + Math.floor(i / COLS) * 60}ms`);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', small.matches ? '8.5' : '6');
      const xMark = document.createElementNS(NS, 'path');
      xMark.setAttribute('class', 'x');
      xMark.setAttribute('d', 'M-2.6-2.6L2.6 2.6M2.6-2.6L-2.6 2.6');
      g.append(c, xMark);
      layer.appendChild(g);
      const home = gridPos(i);
      const rank = data.bh.rank[i];
      return { g, test, hit, kept, rank, home, ranked: { x: rankX(rank, m), y: rankY(test.p) }, x: home.x, y: home.y };
    });
    dots.forEach(place);
    // BH boundary p <= (i/m) q, drawn as a curve on the -log10 p scale.
    bhPath.setAttribute('d', Array.from({ length: m }, (_, k) => {
      const rank = k + 1;
      return `${k ? 'L' : 'M'}${rankX(rank, m).toFixed(1)},${rankY(rank * Q / m).toFixed(1)}`;
    }).join(''));
    const cx = data.bh.k ? rankX(data.bh.k, m) : PX0;
    cut.setAttribute('x1', cx.toFixed(1)); cut.setAttribute('x2', cx.toFixed(1));
    cutLabel.setAttribute('x', (cx + 6).toFixed(1));
    cutLabel.textContent = data.bh.k ? `k = ${data.bh.k}` : 'k = 0';
    // Hits that BH lets go of, in the order a right-to-left sweep meets them.
    dropped = dots.filter((d) => d.hit && !d.kept).sort((a, b) => b.rank - a.rank);
    seedOut.textContent = String(seed);
    const r = data.rawSummary, b = data.bhSummary;
    desc.textContent = `One hundred simulated tests, ten with a real effect. At p < 0.05, ${r.discoveries} are flagged and ${r.falseDiscoveries} of them are noise. Benjamini–Hochberg at q = 0.05 keeps ${b.discoveries}, of which ${b.falseDiscoveries} are noise.`;
  }

  function place(d) { d.g.setAttribute('transform', `translate(${d.x.toFixed(1)} ${d.y.toFixed(1)})`); }

  function moveTo(ranked, animate) {
    const targets = dots.map((d) => (ranked ? d.ranked : d.home));
    const needed = dots.some((d, i) => Math.abs(d.x - targets[i].x) > 0.5 || Math.abs(d.y - targets[i].y) > 0.5);
    if (!animate || !needed) { dots.forEach((d, i) => { d.x = targets[i].x; d.y = targets[i].y; place(d); }); tween = null; return; }
    tween = { start: performance.now(), duration: 1500, from: dots.map((d) => ({ x: d.x, y: d.y })), to: targets, ranked };
  }

  function sayPhase(p) {
    const r = data.rawSummary, b = data.bhSummary;
    const lostReal = dropped.filter((d) => d.test.real).length;
    const lines = {
      1: '100 tests. Ten have a real effect, ninety are pure noise. Nobody tells you which.',
      2: `Flag everything under p = 0.05: <b>${r.discoveries} discoveries</b>. Feels like a good day.`,
      3: `Plot twist: <em>${r.falseDiscoveries} of those ${r.discoveries} are noise</em>. ${pct(r.fdp)} of the “discoveries” are false.`,
      4: 'Line them up by p-value, smallest first. Height is −log₁₀ p, the Manhattan-plot way.',
      5: `Benjamini–Hochberg walks in from the right and stops at the last test under its line. It keeps <b>${b.discoveries}</b>; <em>${b.falseDiscoveries}</em> ${b.falseDiscoveries === 1 ? 'is' : 'are'} noise.${lostReal ? ` It also lets go of ${lostReal} real ${lostReal === 1 ? 'effect' : 'effects'}. Nothing is free.` : ''}`
    };
    narration.innerHTML = lines[p];
  }

  function fillBoard(p) {
    const r = data.rawSummary, b = data.bhSummary;
    const set = (el, value) => { if (el.textContent !== value) { el.textContent = value; el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); } };
    set(board.rawN, p >= 2 ? String(r.discoveries) : '–');
    set(board.rawF, p >= 3 ? String(r.falseDiscoveries) : '–');
    set(board.rawFdp, p >= 3 ? pct(r.fdp) : '–');
    set(board.bhN, p >= 5 ? String(b.discoveries) : '–');
    set(board.bhF, p >= 5 ? String(b.falseDiscoveries) : '–');
    set(board.bhFdp, p >= 5 ? pct(b.fdp) : '–');
  }

  function feedEntry(d) {
    const li = document.createElement('li');
    const kind = d.test.real ? 'real' : 'noise';
    li.innerHTML = `<b class="kf-killer">BH</b><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v4M8 11v4M1 8h4M11 8h4"/></svg><span class="kf-victim ${kind}">test ${d.test.id + 1} · p ${pFmt(d.test.p)}</span><small>${kind}</small>`;
    feed.append(li);
    while (feed.children.length > 6) feed.firstElementChild.remove();
  }

  function setPhase(p, animate) {
    phase = p;
    const m = dots.length;
    stage.classList.toggle('show-hits', p >= 2);
    stage.classList.toggle('show-truth', p >= 3);
    stage.classList.toggle('ranked', p >= 4);
    stage.classList.toggle('show-bh', p >= 5);
    stage.classList.remove('popping', 'scanning');
    clearTimeout(popTimer);
    if (p === 1 && animate) {
      void stage.offsetWidth;
      stage.classList.add('popping');
      popTimer = setTimeout(() => stage.classList.remove('popping'), 2200);
    }
    moveTo(p >= 4, animate);
    // BH sweep state.
    sweep = null;
    feed.textContent = '';
    dots.forEach((d) => d.g.classList.remove('dropped'));
    stage.classList.toggle('bh-cut', false);
    if (p >= 5) {
      if (animate) {
        bhPath.classList.remove('draw'); void bhPath.getBBox(); bhPath.classList.add('draw');
        sweep = { start: performance.now() + 800, duration: 1700, fromX: PX1 + 6, toX: data.bh.k ? rankX(data.bh.k, m) : PX0, queue: dropped.slice() };
        scan.setAttribute('x1', String(PX1 + 6)); scan.setAttribute('x2', String(PX1 + 6));
        stage.classList.add('scanning');
      } else {
        bhPath.classList.remove('draw');
        dropped.forEach((d) => d.g.classList.add('dropped'));
        dropped.slice(-6).forEach(feedEntry);
        stage.classList.add('bh-cut');
      }
    }
    sayPhase(p);
    fillBoard(p);
    steps.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.fStep) === p)));
    steps.forEach((b) => b.classList.toggle('done', Number(b.dataset.fStep) < p));
    loop();
  }

  function updateControls() {
    toggle.hidden = motion.matches || !started || (clock >= END_AT && !playing);
    toggle.textContent = playing ? 'Pause' : 'Play';
    replay.hidden = motion.matches || !started;
  }

  function cancel() { if (frame !== null) window.cancelAnimationFrame(frame); frame = null; last = null; }

  function loop() { if (frame === null && inView && !document.hidden) frame = window.requestAnimationFrame(tick); }

  function tick(now) {
    frame = null;
    let busy = false;
    if (playing && !motion.matches) {
      if (last !== null) clock += now - last;
      last = now;
      const next = phase + 1;
      if (next <= 5 && clock >= PHASE_AT[next - 1]) setPhase(next, true);
      if (clock >= END_AT) { playing = false; last = null; updateControls(); }
      busy = playing;
    } else { last = null; }
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.duration);
      dots.forEach((d, i) => {
        // Stagger by rank on the way into the plot, by grid position on the way back.
        const lag = tween.ranked ? (d.rank - 1) / dots.length * 0.35 : (i / dots.length) * 0.35;
        const k = ease(Math.max(0, Math.min(1, (t - lag) / 0.65)));
        d.x = tween.from[i].x + (tween.to[i].x - tween.from[i].x) * k;
        d.y = tween.from[i].y + (tween.to[i].y - tween.from[i].y) * k;
        place(d);
      });
      if (t >= 1) tween = null; else busy = true;
    }
    if (sweep) {
      const t = (now - sweep.start) / sweep.duration;
      if (t >= 0) {
        const k = ease(Math.min(1, t));
        const sx = sweep.fromX + (sweep.toX - sweep.fromX) * k;
        scan.setAttribute('x1', sx.toFixed(1)); scan.setAttribute('x2', sx.toFixed(1));
        while (sweep.queue.length && sweep.queue[0].ranked.x >= sx) {
          const d = sweep.queue.shift();
          d.g.classList.add('dropped');
          feedEntry(d);
        }
        if (t >= 1) { sweep.queue.forEach((d) => { d.g.classList.add('dropped'); feedEntry(d); }); sweep = null; stage.classList.remove('scanning'); stage.classList.add('bh-cut'); }
      }
      if (sweep) busy = true;
    }
    if (busy) frame = window.requestAnimationFrame(tick);
  }

  function start() {
    cancel();
    root.classList.remove('is-armed');
    started = true;
    playing = true;
    clock = 0;
    moveTo(false, false);
    setPhase(1, true);
    updateControls();
    loop();
  }

  toggle.addEventListener('click', () => {
    if (!playing && clock >= END_AT) { start(); return; }
    playing = !playing;
    if (playing && phase < 5) clock = Math.max(clock, PHASE_AT[phase - 1]);
    updateControls();
    loop();
  });
  replay.addEventListener('click', start);
  fresh.addEventListener('click', () => {
    seed += 1;
    build();
    if (motion.matches) setPhase(5, false); else start();
  });
  steps.forEach((button) => button.addEventListener('click', () => {
    const p = Number(button.dataset.fStep);
    playing = false;
    if (!started && !motion.matches) { started = true; root.classList.remove('is-armed'); }
    clock = PHASE_AT[p - 1];
    setPhase(p, !motion.matches);
    updateControls();
  }));

  function applyMotion() {
    cancel();
    if (motion.matches) { playing = false; started = false; root.classList.remove('is-armed'); setPhase(5, false); }
    updateControls();
  }
  motion.addEventListener('change', applyMotion);
  document.addEventListener('visibilitychange', () => { cancel(); loop(); });
  window.addEventListener('pagehide', cancel);
  window.addEventListener('beforeprint', () => { cancel(); playing = false; setPhase(5, false); });

  build();
  setPhase(5, false);  // complete content first; motion users get the show on scroll
  applyMotion();
  if (!motion.matches && 'IntersectionObserver' in window) {
    root.classList.add('is-armed');
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      cancel();
      if (inView && !started && !motion.matches) start(); else loop();
    }, { threshold: 0.35 }).observe(root);
  } else if (!motion.matches) {
    start();
  }
}
