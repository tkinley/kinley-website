// Build one Student Opportunities digest email for one set of answers.
//
// The digest reuses the page's own engine (assets/student-match-engine.mjs),
// so an email can never recommend something the page itself rules out for
// those answers, and dates come from the same checked data files.
//
// Usage:
//   node scripts/build-digest.mjs --level PhD --citizen no --needs money,travel
//   node scripts/build-digest.mjs --level Undergraduate --citizen yes --needs money --out digest.txt
//
// Options: --today YYYY-MM-DD (default: today), --soon-days N (default 30),
// --later-days N (default 90), --anytime-limit N (default 5), and the
// subscribe form's extra answers: --school kstate|other, --college <id>,
// --stage started|middle|final, --background first-gen,need.
// Every send is a draft for review first; see SUBSCRIPTION.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mergeChecks, groupResults, deadlineText, localToday, NEEDS, LEVELS } from '../assets/student-match-engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The check file's unit tags are display text today. These are the ones that
// name a single K-State college, mapped to the subscribe form's values
// (Biology sits in Arts and Sciences; Food Science sits in Agriculture).
// A unit tag outside this map never excludes anyone.
export const UNIT_COLLEGES = {
  'Arts & Sciences only': 'arts-sciences',
  'Division of Biology only': 'arts-sciences',
  'Food science degree': 'agriculture',
};
const COLLEGES = { 'arts-sciences': 'Arts and Sciences', agriculture: 'Agriculture', engineering: 'Engineering', business: 'Business', education: 'Education', 'health-human': 'Health and Human Sciences', architecture: 'Architecture', 'vet-med': 'Vet Med', other: 'other college' };
const STAGES = { started: 'just started', middle: 'middle of the degree', final: 'final year' };
const STAGE_PATTERNS = {
  started: /\bfirst[- ]year\b|\bfreshman\b|\bnew students?\b/i,
  final: /\bfinal year\b|\blast year of\b|\bseniors?\b/i,
};
const BACKGROUND_LABELS = { 'first-gen': 'first-generation', need: 'financial need' };
const BACKGROUND_PATTERNS = {
  'first-gen': /\bfirst[- ]generation\b/i,
  need: /\bfinancial need\b|\bneed[- ]based\b/i,
};

export function loadLibrary() {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'data/student-opportunities.json'), 'utf8'));
  const checks = JSON.parse(readFileSync(join(ROOT, 'data/eligibility-checks.json'), 'utf8'));
  return mergeChecks(catalog.opportunities || catalog, checks);
}

const oneLine = (s, max = 200) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t;
};

function pickedLine(answers) {
  const bits = [];
  const level = LEVELS.find((l) => l.value === answers.level);
  if (level) bits.push(level.label);
  if (answers.citizen === 'yes') bits.push('U.S. citizen or PR');
  else if (answers.citizen === 'no') bits.push('not a U.S. citizen or PR');
  for (const n of answers.needs || []) bits.push(NEEDS.find((x) => x.id === n)?.label || n);
  if (answers.school === 'kstate') bits.push('K-State');
  else if (answers.school === 'other') bits.push('another university');
  if (answers.college && COLLEGES[answers.college]) bits.push(COLLEGES[answers.college]);
  if (answers.stage && STAGES[answers.stage]) bits.push(STAGES[answers.stage]);
  for (const b of answers.background || []) if (BACKGROUND_LABELS[b]) bits.push(BACKGROUND_LABELS[b]);
  return bits.join(' · ') || 'all answers skipped';
}

function itemBlock(r) {
  const lines = [`- ${r.item.title}${r.amount ? ` · ${r.amount}` : ''}${r.unit ? ` · ${r.unit}` : ''}`];
  const due = deadlineText(r);
  if (due) lines.push(`  ${oneLine(due, 160)}`);
  if (r.who) lines.push(`  ${oneLine(r.who, 180)}`);
  if (r.checks?.length) lines.push(`  ${oneLine(r.checks.join(' '), 200)}`);
  if (r.item.official_url) lines.push(`  ${r.item.official_url}`);
  return lines.join('\n');
}

export function buildDigest({ items, answers, today = localToday(), soonDays = 30, laterDays = 90, anytimeLimit = 5, worthLimit = 4 }) {
  const groups = groupResults(items, answers, today);

  // The extra answers filter on facts the page already carries: K-State-only
  // entries drop out for other schools, and a unit tag that names a different
  // college drops the entry for everyone else.
  let filtered = 0;
  const keep = (r) => {
    if (answers.school === 'other' && r.kstate) { filtered += 1; return false; }
    const unitCollege = r.unit ? UNIT_COLLEGES[r.unit] : null;
    if (answers.college && unitCollege && unitCollege !== answers.college) { filtered += 1; return false; }
    return true;
  };
  const kept = Object.fromEntries(Object.entries(groups).map(([g, list]) => [g, list.filter(keep)]));

  const soon = kept.soon.filter((r) => r.deadline.days <= soonDays);
  // "Coming up" also catches the rest of the page's own 60-day soon group,
  // so a deadline 31 to 60 days out is never dropped between the windows.
  const later = [
    ...kept.soon.filter((r) => r.deadline.days > soonDays),
    ...kept.later.filter((r) => r.deadline.days <= laterDays),
  ].sort((a, b) => a.deadline.days - b.deadline.days);
  const anytime = kept.anytime.slice(0, anytimeLimit);

  // Stage and background cannot rule anything out in the current data, so
  // they work the other way: checked entries whose own text matches them,
  // sitting in the undated groups the dated sections never reach, are pulled
  // into view with the matching line quoted as the reason.
  const patterns = [];
  if (STAGE_PATTERNS[answers.stage]) patterns.push(STAGE_PATTERNS[answers.stage]);
  for (const b of answers.background || []) if (BACKGROUND_PATTERNS[b]) patterns.push(BACKGROUND_PATTERNS[b]);
  const worth = [];
  if (patterns.length) {
    const seen = new Set([...soon, ...later, ...anytime].map((r) => r.item.id));
    for (const r of [...kept.benefits, ...kept.dates]) {
      if (worth.length >= worthLimit) break;
      if (!r.checked || seen.has(r.item.id)) continue;
      const why = [r.who || '', ...(r.checks || [])].find((line) => patterns.some((p) => p.test(line)));
      if (why) worth.push({ r, why });
    }
  }
  const worthBlock = ({ r, why }) => {
    const lines = [`- ${r.item.title}${r.amount ? ` · ${r.amount}` : ''}${r.unit ? ` · ${r.unit}` : ''}`, `  Why you: ${oneLine(why, 180)}`];
    const due = deadlineText(r);
    if (due) lines.push(`  ${oneLine(due, 160)}`);
    if (r.item.official_url) lines.push(`  ${r.item.official_url}`);
    return lines.join('\n');
  };

  const total = soon.length + later.length + anytime.length + worth.length;

  const subject = soon.length
    ? `Student Opportunities: ${soon.length} due in the next ${soonDays} days, ${total} picks for you`
    : `Student Opportunities: ${total} picks for you`;

  const out = [`Subject: ${subject}`, '', `Picked for: ${pickedLine(answers)}`, ''];
  const section = (title, list, render = itemBlock) => {
    if (!list.length) return;
    out.push(title.toUpperCase(), ...list.map(render), '');
  };
  section('Apply soon', soon);
  section('Coming up', later);
  section('Open anytime', anytime);
  section('Also worth a look', worth, worthBlock);
  if (!total) out.push('Nothing new fits those answers right now.', '');
  out.push(
    'From the Student Opportunities list: https://tkinley.github.io/kinley-website/student-match.html',
    'Dates come from the checked entries on that page. Always confirm on the official page before you apply.',
    'To stop these emails, reply STOP or use the unsubscribe link.',
  );
  return { subject, text: out.join('\n'), counts: { soon: soon.length, later: later.length, anytime: anytime.length, worth: worth.length, filtered, out: groups.out.length, total } };
}

function parseArgs(argv) {
  const args = { answers: { level: '', citizen: '', needs: [], kstate: false }, today: localToday(), soonDays: 30, laterDays: 90, anytimeLimit: 5, out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === '--level') args.answers.level = next();
    else if (a === '--citizen') args.answers.citizen = next();
    else if (a === '--needs') args.answers.needs = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--school') args.answers.school = next();
    else if (a === '--college') args.answers.college = next();
    else if (a === '--stage') args.answers.stage = next();
    else if (a === '--background') args.answers.background = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--today') args.today = next();
    else if (a === '--soon-days') args.soonDays = Number(next());
    else if (a === '--later-days') args.laterDays = Number(next());
    else if (a === '--anytime-limit') args.anytimeLimit = Number(next());
    else if (a === '--out') args.out = next();
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const digest = buildDigest({ items: loadLibrary(), ...args });
  if (args.out) writeFileSync(args.out, `${digest.text}\n`);
  else process.stdout.write(`${digest.text}\n`);
  process.stderr.write(`counts: ${JSON.stringify(digest.counts)}\n`);
}
