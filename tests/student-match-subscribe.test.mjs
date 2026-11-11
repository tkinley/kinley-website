import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeChecks } from '../assets/student-match-engine.mjs';
import { buildDigest } from '../scripts/build-digest.mjs';

const TODAY = '2026-11-10';

const opportunities = [
  { id: 'us-grant', title: 'Citizens Only Grant', category: 'scholarships', description: 'For citizens.', benefit_type: '$1,000' },
  { id: 'open-grant', title: 'Open Grant', category: 'scholarships', description: 'For everyone.', benefit_type: '$500' },
  { id: 'rolling-fund', title: 'Rolling Travel Fund', category: 'scholarships', description: 'Rolling travel money.', benefit_type: '' },
  { id: 'later-grant', title: 'Later Grant', category: 'scholarships', description: 'Later.', benefit_type: '$2,000' },
  { id: 'mid-grant', title: 'Mid Grant', category: 'scholarships', description: 'In the 31 to 60 day gap.', benefit_type: '$750' },
  { id: 'as-travel', title: 'A&S Travel Award', category: 'scholarships', description: 'College-limited travel money.', benefit_type: '$500' },
  { id: 'ks-only', title: 'K-State Only Fund', category: 'scholarships', description: 'K-State only.', benefit_type: '$300' },
  { id: 'finish-line', title: 'Finish Line Grant', category: 'scholarships', description: 'For the final year.', benefit_type: '$2,000' },
  { id: 'first-gen-award', title: 'First Gen Award', category: 'scholarships', description: 'For first-generation students.', benefit_type: '$800' },
];

const checks = {
  entries: {
    'us-grant': { needs: ['money'], levels: ['PhD'], citizenship: 'us_only', amount: '$1,000', who: 'PhD students.', deadline: { dates: ['2026-11-20'], label: 'Application deadline' } },
    'open-grant': { needs: ['money'], levels: ['PhD'], citizenship: 'any', amount: '$500', who: 'PhD students.', deadline: { dates: ['2026-11-30'] } },
    'rolling-fund': { needs: ['travel'], levels: null, citizenship: 'any', amount: '', who: 'Grad students.', deadline: { rolling: true, note: 'Rolling. Apply anytime.' } },
    'later-grant': { needs: ['money'], levels: ['PhD'], citizenship: 'any', amount: '$2,000', who: 'PhD students.', deadline: { dates: ['2027-01-25'] } },
    'mid-grant': { needs: ['money'], levels: ['PhD'], citizenship: 'any', amount: '$750', who: 'PhD students.', deadline: { dates: ['2026-12-20'] } },
    'as-travel': { needs: ['travel'], levels: null, citizenship: 'any', kstate: true, unit: 'Arts & Sciences only', amount: '$500', who: 'Arts and Sciences students.', deadline: { rolling: true, note: 'Rolling.' } },
    'ks-only': { needs: ['money'], levels: null, citizenship: 'any', kstate: true, amount: '$300', who: 'K-State students.', deadline: { rolling: true, note: 'Rolling.' } },
    'finish-line': { needs: ['money'], levels: ['PhD'], citizenship: 'any', amount: '$2,000', who: 'Students in their final year of a PhD.', deadline: {}, checked: '2026-11-01' },
    'first-gen-award': { needs: ['money'], levels: null, citizenship: 'any', amount: '$800', who: 'First-generation college students.', deadline: {}, checked: '2026-11-01' },
  },
};

const items = mergeChecks(opportunities, checks);
const base = { level: 'PhD', citizen: 'no', needs: ['money', 'travel'], kstate: false };

test('digest never recommends what the page rules out for the answers', () => {
  const d = buildDigest({ items, answers: base, today: TODAY });
  assert.ok(!d.text.includes('Citizens Only Grant'));
  assert.equal(d.counts.out, 1);
  const yes = buildDigest({ items, answers: { ...base, citizen: 'yes' }, today: TODAY });
  assert.ok(yes.text.includes('Citizens Only Grant'));
});

test('digest windows: soon within 30 days, later within 90, rolling under open anytime', () => {
  const d = buildDigest({ items, answers: base, today: TODAY });
  const soonAt = d.text.indexOf('APPLY SOON');
  const laterAt = d.text.indexOf('COMING UP');
  const anyAt = d.text.indexOf('OPEN ANYTIME');
  assert.ok(soonAt > -1 && laterAt > soonAt && anyAt > laterAt);
  const soonSection = d.text.slice(soonAt, laterAt);
  assert.ok(soonSection.includes('Open Grant'));
  assert.ok(!soonSection.includes('Later Grant'));
  assert.ok(d.text.slice(laterAt, anyAt).includes('Later Grant'));
  assert.ok(d.text.slice(laterAt, anyAt).includes('Mid Grant'));
  assert.ok(!soonSection.includes('Mid Grant'));
  assert.ok(d.text.slice(anyAt).includes('Rolling Travel Fund'));
  assert.ok(d.text.includes('Picked for: PhD · not a U.S. citizen or PR'));
});

test('extra answers: college unit tags and school actually filter the digest', () => {
  const eng = buildDigest({ items, answers: { ...base, college: 'engineering' }, today: TODAY });
  assert.ok(!eng.text.includes('A&S Travel Award'));
  const as = buildDigest({ items, answers: { ...base, college: 'arts-sciences' }, today: TODAY });
  assert.ok(as.text.includes('A&S Travel Award'));
  const other = buildDigest({ items, answers: { ...base, school: 'other' }, today: TODAY });
  assert.ok(!other.text.includes('K-State Only Fund'));
  assert.ok(!other.text.includes('A&S Travel Award'));
  const ks = buildDigest({ items, answers: { ...base, school: 'kstate' }, today: TODAY });
  assert.ok(ks.text.includes('K-State Only Fund'));
});

test('extra answers: stage and background pull matching checked entries into view', () => {
  const plain = buildDigest({ items, answers: base, today: TODAY });
  assert.ok(!plain.text.includes('Finish Line Grant'));
  assert.ok(!plain.text.includes('First Gen Award'));
  const fin = buildDigest({ items, answers: { ...base, stage: 'final' }, today: TODAY });
  assert.ok(fin.text.includes('ALSO WORTH A LOOK'));
  assert.ok(fin.text.includes('Finish Line Grant'));
  assert.ok(fin.text.includes('final year of a PhD'));
  assert.ok(!fin.text.includes('First Gen Award'));
  const fg = buildDigest({ items, answers: { ...base, background: ['first-gen'] }, today: TODAY });
  assert.ok(fg.text.includes('First Gen Award'));
  assert.ok(!fg.text.includes('Finish Line Grant'));
});

test('subscribe form carries the four extra field groups', () => {
  const html = readFileSync(new URL('../student-match.html', import.meta.url), 'utf8');
  for (const g of ['school', 'college', 'stage', 'background']) assert.ok(html.includes(`data-group="${g}"`), g);
  const src = readFileSync(new URL('../assets/student-match-subscribe.mjs', import.meta.url), 'utf8');
  assert.match(src, /background/);
});

test('subscribe module stays dormant until a real form ID replaces the placeholder', () => {
  const src = readFileSync(new URL('../assets/student-match-subscribe.mjs', import.meta.url), 'utf8');
  assert.match(src, /REPLACE_WITH_FORM_ID/);
  assert.match(src, /not live yet/i);
  const html = readFileSync(new URL('../student-match.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="subscribe"'));
  assert.ok(html.includes('https://formspree.io'));
});
