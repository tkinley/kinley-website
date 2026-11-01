// Deterministic matching for the Student Opportunities page.
// Three answers in (level, U.S. citizen or permanent resident, needs),
// five groups out. No scores, no guessing: an entry is ruled out only by a
// rule written in the data, and every rule shows its reason.

export const LEVELS = [
  { id: 'ug', value: 'Undergraduate', label: 'Undergrad' },
  { id: 'ms', value: "Master's", label: "Master's" },
  { id: 'phd', value: 'PhD', label: 'PhD' },
];

export const NEEDS = [
  // The ids stay short and stable because they live in bookmarked links (#needs=money).
  { id: 'money', label: 'Scholarships & fellowships', hint: 'Plus research grants and prizes' },
  { id: 'travel', label: 'Travel funding', hint: 'Conferences and research trips' },
  { id: 'research', label: 'Research tools', hint: 'Compute, databases, lab software' },
  { id: 'software', label: 'Software & AI', hint: 'Free apps, credits, AI tools' },
  { id: 'everyday', label: 'Everyday help', hint: 'Food, health, transit, emergency aid' },
];

export const GROUPS = [
  { id: 'soon', title: 'Apply soon', note: 'Deadlines in the next 60 days.' },
  { id: 'anytime', title: 'Open anytime', note: 'Rolling programs, checked on their official pages.' },
  { id: 'later', title: 'Later deadlines', note: 'More than 60 days out.' },
  { id: 'benefits', title: 'Ongoing benefits', note: 'Tools and services with no deadline in my notes. Not re-checked, so confirm on the official page.' },
  { id: 'dates', title: 'Check the dates', note: 'The round is closed, the next date isn’t posted, or the dates haven’t been checked.' },
];

export const SOON_DAYS = 60;

const CATEGORY_NEEDS = {
  scholarships: ['money'],
  research: ['research'],
  'ai-software': ['software'],
  'campus-benefits': ['everyday'],
  'financial-support': ['everyday'],
  travel: ['travel'],
};

export const KIND_LABELS = {
  scholarships: 'Funding',
  research: 'Research tool',
  'ai-software': 'Software & AI',
  'campus-benefits': 'Campus',
  'financial-support': 'Everyday help',
  travel: 'Travel',
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const levelValues = LEVELS.map((l) => l.value);

// Merge the hand-checked facts over the catalogue. The catalogue stays the
// list of what exists; the overlay is what was confirmed and when.
export function mergeChecks(opportunities, checks = {}) {
  const entries = checks.entries || {};
  return opportunities.map((o) => {
    const check = entries[o.id] || null;
    return {
      ...o,
      title: check?.title || o.title,
      official_url: check?.url || o.official_url,
      check,
    };
  });
}

export function needsOf(item) {
  if (item.check?.needs?.length) return item.check.needs;
  const needs = new Set(CATEGORY_NEEDS[item.category] || []);
  if (item.tags?.includes('Travel') && item.category === 'scholarships') needs.add('travel');
  if (item.tags?.includes('Food') || item.tags?.includes('Health')) needs.add('everyday');
  return [...needs];
}

function levelsOf(item) {
  if (item.check && 'levels' in item.check) return { levels: item.check.levels, exclude: null };
  const rules = item.eligibility_rules?.known || [];
  const allow = rules.find((r) => r.field === 'academic_level' && r.operator === 'in' && !r.when);
  const deny = rules.find((r) => r.field === 'academic_level' && r.operator === 'not_in' && !r.when);
  return { levels: allow ? allow.values : null, exclude: deny ? deny.values : null };
}

function citizenshipOf(item) {
  if (item.check?.citizenship) return item.check.citizenship;
  const status = item.student_status_restrictions;
  if (status?.length === 1 && status[0] === 'international') return 'international_only';
  return 'not_stated';
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function daysBetween(fromIso, toIso) {
  const t = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(toIso) - t(fromIso)) / 86400000);
}

export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The next published date on or after today, or the most recent past one.
export function deadlineState(item, today) {
  const d = item.check?.deadline;
  if (d) {
    const published = (d.dates || []).filter((x) => ISO.test(x));
    const year = Number(today.slice(0, 4));
    const yearly = (d.annual || []).flatMap((md) => [`${year}-${md}`, `${year + 1}-${md}`]);
    const dates = [...new Set([...published, ...yearly])].sort();
    const next = dates.find((x) => x >= today) || null;
    const last = [...dates].reverse().find((x) => x < today) || null;
    if (next) {
      const label = d.labels?.[next] || d.label || '';
      return { kind: 'date', date: next, days: daysBetween(today, next), label, note: d.detail || d.note || '', annual: !published.includes(next) };
    }
    if (d.rolling) return { kind: 'rolling', note: d.note || '' };
    return { kind: 'closed', last, note: d.note || '' };
  }
  // Catalogue-only entries: trust only dates someone verified.
  if (item.deadline?.verified && item.deadline.date) {
    const date = item.deadline.date;
    if (date >= today) return { kind: 'date', date, days: daysBetween(today, date), label: '', note: '' };
    return { kind: 'closed', last: date, note: '' };
  }
  const end = item.availability?.reported_end;
  if (item.availability?.state === 'past_cycle' || (end && end < today)) return { kind: 'closed', last: end || null, note: '' };
  return { kind: 'unchecked', note: '' };
}

// Unchecked benefits whose notes mention an end date or a cohort aren't
// "anytime": they belong with the entries whose dates need checking.
const TIMED = /\bdeadline\b|cohort/i;

const CITIZEN_TEXT = {
  us_only: 'U.S. citizens, nationals, and permanent residents only.',
  us_citizen_only: 'U.S. citizens only. Permanent residents can’t apply.',
};

// answers: { level: '' | 'Undergraduate' | "Master's" | 'PhD', citizen: '' | 'yes' | 'no', needs: [], kstate: false }
//
// Only rules from the checked-facts file can exclude ("reasons"). The same
// kind of rule coming from the unchecked catalogue becomes a warning instead:
// the card stays in its group, says the rule is unverified, and sorts last.
export function evaluate(item, answers = {}, today = localToday()) {
  const level = levelValues.includes(answers.level) ? answers.level : '';
  const citizen = ['yes', 'no'].includes(answers.citizen) ? answers.citizen : '';
  const checked = Boolean(item.check);
  const reasons = [];
  const warnings = [];
  const checks = [];
  const conflict = (text) => (checked ? reasons : warnings).push(text);

  if (item.check?.exclude) reasons.push(item.check.exclude);

  const { levels, exclude } = levelsOf(item);
  if (level && levels && !levels.includes(level)) {
    conflict(checked ? item.check.level_reason || `Open to ${listLevels(levels)} only.` : `My notes list this for ${listLevels(levels)} only. Not checked yet.`);
  }
  if (level && exclude?.includes(level)) conflict(`My notes say this isn't open to ${level} students. Not checked yet.`);

  const rule = citizenshipOf(item);
  if (rule === 'us_only' || rule === 'us_citizen_only') {
    if (citizen === 'no') reasons.push(rule === 'us_only' ? 'Needs U.S. citizenship or permanent residency.' : 'Needs U.S. citizenship.');
    else if (citizen === '' || rule === 'us_citizen_only') checks.push(CITIZEN_TEXT[rule]);
  }
  if (rule === 'international_only') {
    if (citizen === 'yes') conflict(checked ? 'For international students.' : 'My notes list this for international students. Not checked yet.');
    else if (citizen === 'no') checks.push('For international students. If you’re not on a student or exchange visa, confirm your status counts.');
    else checks.push('For international students.');
  }

  for (const line of item.check?.check || []) checks.push(line);

  const deadline = deadlineState(item, today);
  let group;
  if (reasons.length) group = 'out';
  else if (deadline.kind === 'date') group = deadline.days <= SOON_DAYS ? 'soon' : 'later';
  else if (deadline.kind === 'rolling') group = 'anytime';
  else if (deadline.kind === 'closed') group = 'dates';
  else if (item.category === 'scholarships' || TIMED.test(item.deadline?.source_text || '')) group = 'dates';
  else group = 'benefits';

  return {
    item,
    group,
    reasons,
    warnings,
    unit: item.check?.unit || '',
    checks: [...new Set(checks)],
    deadline,
    needs: needsOf(item),
    amount: amountOf(item),
    who: item.check?.who || item.description,
    kstate: item.check ? Boolean(item.check.kstate) : Boolean(item.source?.categories?.includes('kstate')),
    checked: item.check?.checked || item.last_verified || null,
  };
}

function listLevels(levels) {
  const names = levels.map((l) => (l === 'Undergraduate' ? 'undergrads' : l === 'PhD' ? 'PhD students' : l === "Master's" ? "master's students" : l));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
}

function amountOf(item) {
  if (item.check && 'amount' in item.check) return item.check.amount || '';
  const b = String(item.benefit_type || '');
  // Amounts from unchecked notes keep their uncertainty on the card.
  if (item.category === 'scholarships') return /[$€]\s?\d/.test(b) ? `${b.replace(/^Reported\s+/i, '')} (from my notes, not checked)` : '';
  if (!b || /^(Varies|Not specified in source|Amount not established)$/i.test(b)) return '';
  return b;
}

export function deadlineText(result) {
  const d = result.deadline;
  if (d.kind === 'date') {
    const left = d.days === 0 ? 'due today' : d.days === 1 ? '1 day left' : `${d.days} days left`;
    // A yearly cycle the source lists without a year is a likely date, not a confirmed one.
    if (d.annual) return [`Likely ${formatDate(d.date)} (yearly cycle, not confirmed)`, left].join(' · ');
    return [`Due ${formatDate(d.date)}` + (d.label ? ` (${d.label})` : ''), left].join(' · ');
  }
  if (d.kind === 'rolling') return d.note || 'Rolling. Apply anytime.';
  if (d.kind === 'closed') return d.note || (d.last ? `Last round closed ${formatDate(d.last)}. Next date not posted.` : 'Last round closed. Next date not posted.');
  const notes = String(result.item.deadline?.source_text || '').trim();
  if (notes) {
    const short = notes.length > 110 ? `${notes.slice(0, 107).replace(/\s+\S*$/, '')}…` : notes;
    return `My notes: ${/[.!?…]$/.test(short) ? short : `${short}.`} Not checked yet.`;
  }
  return result.item.category === 'scholarships' ? 'Dates not checked yet. See the official page.' : '';
}

const haystack = (r) => [r.item.title, r.who, r.item.description, r.item.notes, r.amount, ...(r.item.tags || [])].join(' ').toLowerCase();

const byTitle = (a, b) => a.item.title.localeCompare(b.item.title);
const flag = (x) => Number(Boolean(x));
// Unverified conflicts always sink to the bottom of their group.
const warned = (a, b) => flag(a.warnings.length) - flag(b.warnings.length);
const byDate = (a, b) => warned(a, b) || a.deadline.days - b.deadline.days || byTitle(a, b);
// In the long, undated groups, K-State entries come first, then checked ones.
const local = (a, b) => warned(a, b) || flag(b.kstate) - flag(a.kstate) || flag(!a.item.check) - flag(!b.item.check);
const SORTS = {
  soon: byDate,
  later: byDate,
  anytime: (a, b) => local(a, b) || flag(a.item.category !== 'scholarships') - flag(b.item.category !== 'scholarships') || byTitle(a, b),
  benefits: (a, b) => local(a, b) || byTitle(a, b),
  dates: (a, b) => local(a, b) || byTitle(a, b),
  out: byTitle,
};

// Entries that don't match the chosen needs are left out entirely; entries
// that match but are ruled out land in "out" with their reasons.
export function groupResults(items, answers = {}, today = localToday(), query = '') {
  const needs = (answers.needs || []).filter((n) => NEEDS.some((x) => x.id === n));
  const q = String(query).toLowerCase().trim();
  const groups = { soon: [], anytime: [], later: [], benefits: [], dates: [], out: [] };
  for (const item of items) {
    const r = evaluate(item, answers, today);
    if (needs.length && !r.needs.some((n) => needs.includes(n))) continue;
    if (answers.kstate && !r.kstate) continue;
    if (q && !haystack(r).includes(q)) continue;
    groups[r.group].push(r);
  }
  for (const [id, list] of Object.entries(groups)) list.sort(SORTS[id]);
  return groups;
}

// Level, needs, and the K-State-only toggle live in the URL hash so a list
// can be bookmarked or shared. The citizenship answer is never written there.
export function toHash(answers = {}) {
  const parts = [];
  const level = LEVELS.find((l) => l.value === answers.level);
  if (level) parts.push(`level=${level.id}`);
  const needs = (answers.needs || []).filter((n) => NEEDS.some((x) => x.id === n));
  if (needs.length) parts.push(`needs=${needs.join(',')}`);
  if (answers.kstate) parts.push('ks=1');
  return parts.length ? `#${parts.join('&')}` : '';
}

export function fromHash(hash = '') {
  const raw = String(hash).replace(/^#/, '');
  if (raw === 'scholarships') return { level: '', needs: ['money'], kstate: false };
  const params = new URLSearchParams(raw);
  const level = LEVELS.find((l) => l.id === params.get('level'))?.value || '';
  const needs = (params.get('needs') || '').split(',').filter((n) => NEEDS.some((x) => x.id === n));
  return { level, needs: [...new Set(needs)], kstate: params.get('ks') === '1' };
}
