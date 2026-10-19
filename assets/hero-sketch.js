// Hero sketch: two cells signal, pair, and pass a plasmid, then a mobile
// element moves. A schematic, not to scale. Each loop shuffles the gene order
// differently, which is the combinatorics part.
const root = document.getElementById('cells-sketch');
if (root) initCells(root);

function initCells(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const toggle = root.querySelector('[data-cells-toggle]');
  const status = root.querySelector('[data-cells-status]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const W = 420, H = 232, CY = 100;
  const LOOP = 16;
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  const C = {
    ink: pick('--ink', '#263c33'), ink2: pick('--ink-2', '#506158'), teal: pick('--teal', '#246354'),
    genes: [pick('--teal', '#246354'), pick('--cyan', '#315f77'), pick('--amber', '#976323'), pick('--violet', '#6d587d')],
    mge: pick('--rose', '#984858'),
  };
  // Five segments on the plasmid: four genes and one mobile element (index 4).
  const color = (i) => (i === 4 ? C.mge : C.genes[i]);

  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let v = Math.imul(s ^ (s >>> 15), 1 | s); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffled(seed) {
    const r = seeded(seed);
    for (;;) {
      const a = [0, 1, 2, 3, 4];
      for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      if (a.some((v, i) => v !== i)) return a;
    }
  }

  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const span = (t, a, b) => ease((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;

  let loop = 0;
  let order = shuffled(1);
  let particles = [];
  let rng = seeded(7);

  // Geometry that moves: the recipient slides closer during contact.
  function layout(t) {
    const close = span(t, 5, 6.6) * (1 - span(t, 13, 14.4));
    const dx = 112, rx = lerp(308, 290, close);
    return { dx, rx, half: 78, r: 35, close };
  }

  function capsule(cx, cy, half, r) {
    ctx.beginPath();
    ctx.moveTo(cx - half + r, cy - r);
    ctx.lineTo(cx + half - r, cy - r);
    ctx.arc(cx + half - r, cy, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(cx - half + r, cy + r);
    ctx.arc(cx - half + r, cy, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
  }

  function chromosomePath(cx, cy, phase) {
    ctx.beginPath();
    for (let k = 0; k <= 96; k += 1) {
      const a = (k / 96) * Math.PI * 2;
      const wob = 2.6 * Math.sin(7 * a + phase);
      const x = cx + (38 + wob) * Math.cos(a);
      const y = cy + (16 + wob * 0.6) * Math.sin(a);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function plasmid(cx, cy, slots, spin, alpha = 1) {
    // slots: [{gene, at}] where at is the slot position 0..4 (fractional while shuffling)
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineWidth = 4.2;
    for (const { gene, at } of slots) {
      const a0 = spin + at * (Math.PI * 2 / 5) + 0.12;
      ctx.strokeStyle = color(gene);
      ctx.beginPath();
      ctx.arc(cx, cy, 12.5, a0, a0 + Math.PI * 2 / 5 - 0.24);
      ctx.stroke();
    }
    ctx.restore();
  }

  function emit(L, t) {
    // Signal molecules leave both cells; the rate climbs until the quorum.
    const rate = t < 4.2 ? lerp(6, 30, t / 4.2) : t < 13 ? 8 : 3;
    const n = rate / 60;
    let count = Math.floor(n) + (rng() < n % 1 ? 1 : 0);
    while (count-- > 0 && particles.length < 170) {
      const fromDonor = rng() < 0.5;
      const cx = fromDonor ? L.dx : L.rx;
      const a = rng() * Math.PI * 2;
      particles.push({ x: cx + Math.cos(a) * (L.half - 6), y: CY + Math.sin(a) * L.r, vx: Math.cos(a) * 0.35, vy: Math.sin(a) * 0.35, life: 0, max: 4 + rng() * 3 });
    }
  }

  function stepParticles(dt) {
    for (const p of particles) {
      p.vx = p.vx * 0.985 + (rng() - 0.5) * 0.09;
      p.vy = p.vy * 0.985 + (rng() - 0.5) * 0.09;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life += dt;
    }
    particles = particles.filter((p) => p.life < p.max && p.x > -10 && p.x < W + 10 && p.y > -10 && p.y < H + 10);
  }

  function steadyParticles() {
    const r = seeded(11);
    particles = Array.from({ length: 80 }, () => ({ x: 20 + r() * (W - 40), y: 24 + r() * (H - 70), vx: 0, vy: 0, life: r() * 3, max: 6 }));
  }

  function label(t) {
    const steps = [
      [0, 'Signal molecules build up'],
      [4.2, 'Enough signal: both cells switch on'],
      [5, 'The donor reaches out and pairs'],
      [6.8, 'A copy of its plasmid crosses over'],
      [9.6, 'A mobile element shuffles the gene order'],
      [11.6, 'It jumps into the chromosome'],
      [13.2, 'Both cells now carry the plasmid'],
    ];
    let idx = 0;
    steps.forEach(([at], i) => { if (t >= at) idx = i; });
    return { n: idx + 1, text: steps[idx][1], fresh: span(t, steps[idx][0], steps[idx][0] + 0.35) };
  }

  function draw(t, still = false) {
    const L = layout(t);
    ctx.clearRect(0, 0, W, H);
    const fade = still ? 1 : span(t, 0, 0.6) * (1 - span(t, LOOP - 0.6, LOOP));
    ctx.globalAlpha = fade;

    // Signal molecules.
    for (const p of particles) {
      const a = Math.min(1, p.life / 0.4) * (1 - Math.max(0, (p.life - p.max + 1)));
      ctx.fillStyle = C.ink2;
      ctx.globalAlpha = fade * 0.55 * Math.max(0, a);
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = fade;

    // Cells. They warm up once the signal crosses the threshold.
    const on = still ? 1 : span(t, 4.2, 5.2);
    for (const cx of [L.dx, L.rx]) {
      ctx.save();
      ctx.shadowColor = `rgba(36,99,84,${0.35 * on})`;
      ctx.shadowBlur = 18 * on;
      capsule(cx, CY, L.half, L.r);
      ctx.fillStyle = `rgba(36,99,84,${0.05 + 0.07 * on})`;
      ctx.fill();
      ctx.restore();
      capsule(cx, CY, L.half, L.r);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = on > 0.5 ? C.teal : C.ink;
      ctx.stroke();
    }

    // Chromosomes, faint.
    const spin = still ? 0.4 : t * 0.35;
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(38,60,51,.32)';
    chromosomePath(L.dx - 12, CY, 0.6); ctx.stroke();
    chromosomePath(L.rx + 12, CY, 2.1); ctx.stroke();

    // Bridge between the cells.
    const grow = still ? 0 : span(t, 5, 6.4) * (1 - span(t, 13, 13.8));
    const x0 = L.dx + L.half, x1 = L.rx - L.half;
    if (grow > 0) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.4;
      for (const off of [-4, 4]) {
        ctx.beginPath(); ctx.moveTo(x0 - 2, CY + off); ctx.lineTo(lerp(x0 - 2, x1 + 2, grow), CY + off); ctx.stroke();
      }
    }

    // Donor plasmid keeps its copy throughout.
    const donorSite = { x: L.dx + 44, y: CY };
    plasmid(donorSite.x, donorSite.y, [0, 1, 2, 3, 4].map((g, i) => ({ gene: g, at: i })), spin);

    // The single strand travelling through the bridge, then closing into a ring.
    const recvSite = { x: L.rx - 44, y: CY };
    const travel = still ? 1 : span(t, 6.8, 9.2);
    if (!still && travel > 0 && travel < 1) {
      const path = [donorSite, { x: x0, y: CY }, { x: x1, y: CY }, recvSite];
      const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
      const total = lens.reduce((a, b) => a + b, 0);
      const at = (d) => {
        let rem = Math.max(0, Math.min(total, d));
        for (let i = 0; i < lens.length; i += 1) {
          if (rem <= lens[i]) { const k = rem / lens[i]; return { x: lerp(path[i].x, path[i + 1].x, k), y: lerp(path[i].y, path[i + 1].y, k) }; }
          rem -= lens[i];
        }
        return path[path.length - 1];
      };
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      for (let i = 0; i < 5; i += 1) {
        const head = travel * (total + 50) - i * 10;
        const a = at(head), b = at(head - 7);
        ctx.strokeStyle = color(i);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    // The new plasmid in the recipient: forms, reshuffles, loses the jumper.
    const formed = still ? 1 : span(t, 8.8, 9.6);
    if (formed > 0) {
      const shuffle = still ? 1 : span(t, 9.8, 11.4);
      const hop = still ? 1 : span(t, 11.6, 12.8);
      const target = order.indexOf.bind(order);
      const slots = [0, 1, 2, 3, 4]
        .filter((g) => !(g === 4 && hop > 0))
        .map((g) => ({ gene: g, at: lerp(g, target(g), shuffle) }));
      plasmid(recvSite.x, recvSite.y, slots, spin, formed);

      // The mobile element leaves the ring for the chromosome.
      const insertAt = { x: L.rx + 12 + 38 * Math.cos(-1.2), y: CY + 16 * Math.sin(-1.2) };
      if (hop > 0) {
        const from = { x: recvSite.x + 12.5 * Math.cos(spin + target(4) * 1.2566 + 0.7), y: recvSite.y + 12.5 * Math.sin(spin + target(4) * 1.2566 + 0.7) };
        const p = { x: lerp(from.x, insertAt.x, hop), y: lerp(from.y, insertAt.y, hop) - Math.sin(hop * Math.PI) * 22 };
        ctx.strokeStyle = C.mge;
        ctx.lineWidth = 4.6;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - 4, p.y - 1.5); ctx.lineTo(p.x + 4, p.y + 1.5); ctx.stroke();
      }
    }

    // Step caption inside the figure.
    if (!still) {
      const s = label(t);
      ctx.globalAlpha = fade * (0.35 + 0.65 * s.fresh);
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.fillStyle = C.teal;
      ctx.fillText(String(s.n), 14, H - 12);
      ctx.font = '400 14px Inter, system-ui, sans-serif';
      ctx.fillStyle = C.ink;
      ctx.fillText(s.text, 32, H - 12);
    }
    ctx.globalAlpha = 1;
  }

  function size() {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.width * (H / W) * dpr);
    ctx.setTransform((box.width * dpr) / W, 0, 0, (box.width * dpr) / W, 0, 0);
  }

  let t = 0, last = null, frame = null, playing = true, inView = true;
  function tick(now) {
    frame = null;
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (t >= LOOP) { t = 0; loop += 1; order = shuffled(loop + 1); particles = []; }
    const L = layout(t);
    emit(L, t);
    stepParticles(dt);
    draw(t);
    schedule();
  }
  function schedule() {
    if (frame === null && playing && inView && !document.hidden && !motion.matches) frame = requestAnimationFrame(tick);
  }
  function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; last = null; }

  function still() {
    stop();
    steadyParticles();
    draw(14.5, true);
  }

  function applyMotion() {
    size();
    if (motion.matches) {
      toggle.hidden = true;
      still();
      status.textContent = 'Static diagram: two cells side by side, both carrying the plasmid, with the mobile element now in the recipient chromosome.';
    } else {
      toggle.hidden = false;
      draw(t);
      schedule();
    }
  }

  toggle.addEventListener('click', () => {
    playing = !playing;
    toggle.textContent = playing ? 'Pause' : 'Play';
    toggle.setAttribute('aria-pressed', String(!playing));
    status.textContent = playing ? 'Animation playing.' : 'Animation paused.';
    if (playing) schedule(); else stop();
  });
  motion.addEventListener('change', applyMotion);
  document.addEventListener('visibilitychange', () => { stop(); schedule(); });
  window.addEventListener('resize', () => { size(); draw(motion.matches ? 14.5 : t, motion.matches); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; if (inView) schedule(); else stop(); }).observe(root);
  }
  window.addEventListener('beforeprint', () => { stop(); still(); });
  window.addEventListener('afterprint', applyMotion);

  applyMotion();
}
