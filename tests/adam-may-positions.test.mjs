import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('../data/adam-may-positions.json', import.meta.url), 'utf8'));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => ISO.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const SIDES = new Set(['long', 'short', 'mixed']);
const EVIDENCE = new Set(['stated', 'pitch', 'call', 'title', 'unclear']);
const STATUS = new Set(['open', 'closed', 'carried', 'unknown', 'none']);
const OUTCOMES = new Set(['won', 'lost', 'pending', 'unclear']);
const httpsOnly = (u) => typeof u === 'string' && u.startsWith('https://');

test('top-level fields are present', () => {
  assert.ok(isDate(D.updated), 'updated must be YYYY-MM-DD');
  for (const k of ['positions', 'events', 'scorecard', 'pitches']) assert.ok(Array.isArray(D[k]), k);
});

test('every position is well formed and sourced', () => {
  const seen = new Set();
  for (const p of D.positions) {
    const id = `${p.period}/${p.ticker}`;
    assert.ok(!seen.has(id), `duplicate position ${id}`);
    seen.add(id);
    assert.ok(['2024', '2025', '2026'].includes(p.period), `${id} period`);
    assert.ok(SIDES.has(p.side), `${id} side`);
    assert.ok(EVIDENCE.has(p.evidence), `${id} evidence`);
    assert.ok(STATUS.has(p.status), `${id} status`);
    assert.ok(isDate(p.firstSeen) && isDate(p.lastSeen), `${id} dates`);
    assert.ok(p.firstSeen <= p.lastSeen, `${id} firstSeen after lastSeen`);
    assert.ok(p.lastSeen <= D.updated, `${id} lastSeen after updated`);
    assert.ok(p.sources.length >= 1 && p.sources.every((s) => httpsOnly(s.url)), `${id} sources`);
    assert.ok(p.statusNote && p.summary, `${id} text`);
  }
});

test('only stated or pitched positions are shown as open', () => {
  for (const p of D.positions) {
    if (p.status === 'open') assert.ok(['stated', 'pitch'].includes(p.evidence), `${p.ticker} is open without his own words`);
  }
});

test('events are dated, sourced, and newest first', () => {
  for (let i = 0; i < D.events.length; i++) {
    const e = D.events[i];
    assert.ok(isDate(e.date) && e.date <= D.updated, `event date ${e.date}`);
    assert.ok(httpsOnly(e.url), `event url ${e.date}`);
    assert.ok(Array.isArray(e.tickers));
    if (i) assert.ok(D.events[i - 1].date >= e.date, `events out of order at ${e.date}`);
  }
});

test('X post IDs match the dates they are filed under', () => {
  // Snowflake IDs encode the post time: ms = (id >> 22) + 1288834974657.
  const xDate = (url) => {
    const m = url.match(/status\/(\d+)/);
    if (!m) return null;
    return new Date(Number((BigInt(m[1]) >> 22n) + 1288834974657n)).toISOString().slice(0, 10);
  };
  const near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) <= 2 * 86400000;
  for (const e of D.events) {
    const d = xDate(e.url);
    if (d) assert.ok(near(d, e.date), `event ${e.date} links a post from ${d}`);
  }
});

test('scorecard and court list are well formed', () => {
  for (const s of D.scorecard) {
    assert.ok(OUTCOMES.has(s.outcome) && isDate(s.date) && httpsOnly(s.url), s.ticker);
  }
  for (const c of D.courtNamed) assert.ok(c.ticker && c.company && ['2025', '2026'].includes(c.period));
});

test('pitches are dated, priced, and sourced', () => {
  assert.ok(Array.isArray(D.pitches) && D.pitches.length >= 1);
  for (const x of D.pitches) {
    assert.ok(x.ticker && x.company && isDate(x.date) && /^\$\d/.test(x.price) && httpsOnly(x.url), x.ticker);
    assert.ok(D.positions.some((p) => p.ticker === x.ticker && p.evidence === 'pitch'), `${x.ticker} pitch has no matching position`);
  }
});
