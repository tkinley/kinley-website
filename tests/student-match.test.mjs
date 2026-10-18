import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NEEDS, mergeChecks, evaluate, groupResults, deadlineState, deadlineText, toHash, fromHash, daysBetween } from '../assets/student-match-engine.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const catalogue = await read('../data/student-opportunities.json');
const checks = await read('../data/eligibility-checks.json');
const items = mergeChecks(catalogue.opportunities, checks);
const byId = (id) => items.find((o) => o.id === id);
const TODAY = '2026-10-18';
const titles = (list) => list.map((r) => r.item.id);

test('catalogue cards still match the resource library one to one', async () => {
  const html = await readFile(new URL('../student-benefits.html', import.meta.url), 'utf8');
  const cards = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length, 108);
  assert.equal(catalogue.opportunities.length, 158);
  assert.equal(new Set(catalogue.opportunities.map((o) => o.id)).size, catalogue.opportunities.length);
  for (const [i, card] of cards.entries()) {
    const o = catalogue.opportunities[i].original_card || catalogue.opportunities[i];
    assert.equal(o.official_url, card[1].match(/href="([^"]*)"/)[1].replace(/&amp;/g, '&'));
  }
});

test('every checked entry exists, cites a source, and uses a known shape', () => {
  const ids = new Set(catalogue.opportunities.map((o) => o.id));
  const needIds = NEEDS.map((n) => n.id);
  const entries = Object.entries(checks.entries);
  assert.ok(entries.length >= 25);
  for (const [id, e] of entries) {
    assert.ok(ids.has(id), `${id} is not in the catalogue`);
    assert.match(e.source, /^https:\/\//, id);
    assert.match(e.checked, /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(['us_only', 'us_citizen_only', 'international_only', 'any', 'not_stated'].includes(e.citizenship), id);
    assert.ok(e.needs.length && e.needs.every((n) => needIds.includes(n)), id);
    assert.ok(e.levels === null || e.levels.every((l) => ['Undergraduate', "Master's", 'PhD'].includes(l)), id);
    for (const d of e.deadline.dates || []) assert.match(d, /^\d{4}-\d{2}-\d{2}$/, id);
    for (const d of e.deadline.annual || []) assert.match(d, /^\d{2}-\d{2}$/, id);
    assert.ok(e.who && e.who.length < 260, id);
  }
});

test('no em dashes in hand-written copy or checked facts', async () => {
  for (const path of ['../data/eligibility-checks.json', '../student-match.html', '../assets/student-match.mjs', '../assets/student-match-engine.mjs']) {
    assert.doesNotMatch(await readFile(new URL(path, import.meta.url), 'utf8'), /—/, path);
  }
});

test('a student-visa PhD student loses only the federal fellowships, each with its reason', () => {
  const g = groupResults(items, { level: 'PhD', citizen: 'no', needs: ['money'] }, TODAY);
  const out = Object.fromEntries(g.out.map((r) => [r.item.id, r.reasons[0]]));
  for (const id of ['nsf-grfp', 'doe-scgsr', 'nih-f31', 'usda-nifa-afri-predoctoral']) assert.match(out[id], /citizenship or permanent residency/);
  for (const id of ['boren-fellowship', 'fulbright-us-student-program']) assert.equal(out[id], 'Needs U.S. citizenship.');
  const kept = [...g.soon, ...g.anytime, ...g.later, ...g.dates].map((r) => r.item.id);
  for (const id of ['sigma-xi-giar', 'gsc-travel-funding', 'phi-kappa-phi-graduate-research-grant', 'daad-doctoral-programmes']) assert.ok(kept.includes(id), id);
});

test('skipping the citizenship question rules nothing out but says what to check', () => {
  const r = evaluate(byId('nsf-grfp'), { level: 'PhD' }, TODAY);
  assert.equal(r.group, 'soon');
  assert.ok(r.checks.some((c) => /permanent residents only/.test(c)));
  assert.ok(r.checks.some((c) => /less than one academic year/.test(c)));
  const boren = evaluate(byId('boren-fellowship'), { level: 'PhD', citizen: 'yes' }, TODAY);
  assert.equal(boren.group, 'later');
  assert.ok(boren.checks.some((c) => /Permanent residents can.t apply/.test(c)));
});

test('international-only awards leave a citizen list and stay for visa holders', () => {
  for (const id of ['k-state-alumni-international-leadership-award', 'm-h-international-scholarship']) {
    assert.equal(evaluate(byId(id), { citizen: 'yes' }, TODAY).group, 'out', id);
    assert.notEqual(evaluate(byId(id), { citizen: 'no' }, TODAY).group, 'out', id);
  }
});

test('level rules exclude with a readable reason', () => {
  assert.equal(evaluate(byId('sarachek-predoctoral-honors-fellowship'), { level: "Master's" }, TODAY).reasons[0], 'Open to PhD students only.');
  assert.match(evaluate(byId('timothy-r-donoghue-graduate-scholarship'), { level: 'PhD' }, TODAY).reasons[0], /about to start a K-State grad program/);
  assert.match(evaluate(byId('noster-science-microbiome-prize'), {}, TODAY).reasons[0], /PhD or MD already/);
  assert.equal(evaluate(byId('sarachek-predoctoral-honors-fellowship'), {}, TODAY).group, 'dates');
});

test('deadlines: next published date, annual cycles, rolling, and closed rounds', () => {
  assert.equal(deadlineState(byId('nih-f31'), TODAY).date, '2026-12-08');
  assert.equal(deadlineState(byId('nih-f31'), '2026-12-09').date, '2027-04-08');
  assert.equal(deadlineState(byId('sigma-xi-giar'), TODAY).date, '2027-03-15');
  assert.equal(deadlineState(byId('sigma-xi-giar'), '2027-03-16').date, '2027-10-01');
  assert.equal(deadlineState(byId('gsc-travel-funding'), TODAY).kind, 'rolling');
  const afri = deadlineState(byId('usda-nifa-afri-predoctoral'), TODAY);
  assert.equal(afri.kind, 'closed');
  assert.equal(afri.last, '2026-04-16');
  assert.equal(evaluate(byId('nsf-grfp'), { citizen: 'yes' }, '2026-10-20').group, 'dates');
  assert.equal(daysBetween('2026-10-18', '2026-10-19'), 1);
  assert.equal(deadlineText(evaluate(byId('nsf-grfp'), {}, TODAY)), 'Due Oct 19, 2026 (Life Sciences) · 1 day left');
});

test('soon and later split at 60 days and sort by date', () => {
  const g = groupResults(items, { level: 'PhD', citizen: 'yes', needs: ['money'] }, TODAY);
  assert.ok(g.soon.every((r) => r.deadline.days <= 60));
  assert.ok(g.later.every((r) => r.deadline.days > 60));
  assert.deepEqual(g.soon.map((r) => r.deadline.date), [...g.soon.map((r) => r.deadline.date)].sort());
  assert.equal(g.soon[0].item.id, 'nsf-grfp');
});

test('unchecked catalogue entries are never presented with dates nobody verified', () => {
  const g = groupResults(items, {}, TODAY);
  for (const r of [...g.soon, ...g.later]) assert.ok(r.item.check || r.item.deadline?.verified, r.item.id);
  const unchecked = g.dates.filter((r) => !r.item.check && r.deadline.kind === 'unchecked');
  assert.ok(unchecked.length);
  assert.ok(unchecked.every((r) => /not checked yet/.test(deadlineText(r))));
});

test('needs filter, and nothing is lost without answers', () => {
  const all = groupResults(items, {}, TODAY);
  const total = Object.values(all).reduce((n, list) => n + list.length, 0);
  assert.equal(total, items.length);
  const food = groupResults(items, { needs: ['everyday'] }, TODAY, 'cupboard');
  assert.deepEqual(titles(food.anytime), ['cats-cupboard']);
  const software = groupResults(items, { needs: ['software'] }, TODAY);
  assert.ok(Object.values(software).flat().every((r) => r.needs.includes('software')));
  assert.ok(titles(groupResults(items, { needs: ['travel'] }, TODAY).anytime).includes('gsc-travel-funding'));
});

test('hash keeps level and needs, never citizenship', () => {
  const hash = toHash({ level: 'PhD', citizen: 'no', needs: ['money', 'travel'] });
  assert.equal(hash, '#level=phd&needs=money,travel');
  assert.doesNotMatch(hash, /citizen|visa|no/);
  assert.deepEqual(fromHash(hash), { level: 'PhD', needs: ['money', 'travel'] });
  assert.deepEqual(fromHash('#scholarships'), { level: '', needs: ['money'] });
  assert.deepEqual(fromHash('#level=bogus&needs=money,<script>'), { level: '', needs: ['money'] });
  assert.equal(toHash({}), '');
});
