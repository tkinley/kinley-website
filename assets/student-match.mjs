import { NEEDS, GROUPS, KIND_LABELS, mergeChecks, groupResults, deadlineText, formatDate, localToday, toHash, fromHash } from './student-match-engine.mjs?v=6';

const $ = (id) => document.getElementById(id);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const PREVIEW = 6;
const form = $('answers');
let items = [];
const expanded = new Set();

for (const need of NEEDS) {
  const label = make('label', 'option need');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'needs';
  input.value = need.id;
  const text = make('span', '', need.label);
  label.append(input, text);
  $('need-options').append(label);
}

function readAnswers() {
  const data = new FormData(form);
  return { level: data.get('level') || '', citizen: data.get('citizen') || '', needs: data.getAll('needs'), kstate: $('kstate-only').checked };
}

function writeAnswers({ level = '', needs = [], kstate = false }) {
  for (const input of form.querySelectorAll('input[name="level"]')) input.checked = input.value === level;
  for (const input of form.querySelectorAll('input[name="needs"]')) input.checked = needs.includes(input.value);
  $('kstate-only').checked = kstate;
}

function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function card(result) {
  const { item } = result;
  const article = make('article', 'card');
  article.dataset.id = item.id;

  const tags = make('p', 'card-tags');
  tags.append(make('span', '', KIND_LABELS[item.category] || 'Resource'));
  if (result.kstate) tags.append(make('span', 'tag-ks', 'K-State'));
  if (result.unit) tags.append(make('span', 'tag-unit', result.unit));
  article.append(tags);

  const h4 = make('h4');
  const href = safeUrl(item.official_url);
  if (href) {
    const link = make('a', '', item.title);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(make('span', 'visually-hidden', ' (opens official site in a new tab)'));
    h4.append(link);
  } else h4.textContent = item.title;
  article.append(h4);

  if (result.amount) article.append(make('p', 'amount', result.amount));
  const who = result.who.length > 200 ? `${result.who.slice(0, 197).replace(/\s+\S*$/, '')}…` : result.who;
  article.append(make('p', 'who', who));

  const when = deadlineText(result);
  if (when) {
    const line = make('p', `when when-${result.deadline.kind}`, when);
    if (result.deadline.kind === 'date' && result.deadline.days <= 14) line.classList.add('urgent');
    article.append(line);
    if (result.deadline.kind === 'date' && result.deadline.note) article.append(make('p', 'when-note', result.deadline.note));
  }

  for (const line of result.warnings) {
    const warn = make('p', 'warning', line);
    article.classList.add('is-warned');
    article.append(warn);
  }

  if (result.checks.length) {
    const list = make('ul', 'checks');
    list.setAttribute('aria-label', 'Before you apply');
    for (const line of result.checks) list.append(make('li', '', line));
    article.append(list);
  }

  const meta = make('p', 'meta');
  meta.textContent = result.checked ? `Checked ${formatDate(result.checked)}` : 'Not re-checked yet';
  if (item.check?.source_note) meta.title = item.check.source_note;
  article.append(meta);
  return article;
}

function render() {
  const answers = readAnswers();
  const query = $('search').value;
  const groups = groupResults(items, answers, localToday(), query);
  const container = $('groups');
  container.replaceChildren();
  let shown = 0;

  for (const { id, title, note } of GROUPS) {
    const list = groups[id];
    if (!list.length) continue;
    shown += list.length;
    const section = make('section', `group group-${id}`);
    section.id = `group-${id}`;
    section.setAttribute('aria-labelledby', `group-${id}-title`);
    const head = make('div', 'group-head');
    const h3 = make('h3', '', title);
    h3.id = `group-${id}-title`;
    h3.append(make('span', 'count', String(list.length)));
    head.append(h3, make('p', 'group-note', note));
    section.append(head);
    const grid = make('div', 'cards');
    const open = expanded.has(id) || query.trim();
    for (const r of open ? list : list.slice(0, PREVIEW)) grid.append(card(r));
    section.append(grid);
    if (!open && list.length > PREVIEW) {
      const more = make('button', 'button secondary show-all', `Show all ${list.length}`);
      more.type = 'button';
      more.addEventListener('click', () => {
        expanded.add(id);
        render();
        document.querySelector(`#group-${id} .card:nth-child(${PREVIEW + 1}) a`)?.focus();
      });
      section.append(more);
    }
    container.append(section);
  }

  const out = groups.out;
  $('group-out').hidden = !out.length;
  $('out-count').textContent = String(out.length);
  const outList = $('out-list');
  outList.replaceChildren();
  for (const r of out) {
    const li = make('li');
    const href = safeUrl(r.item.official_url);
    const name = href ? make('a', '', r.item.title) : make('span', '', r.item.title);
    if (href) { name.href = href; name.target = '_blank'; name.rel = 'noopener noreferrer'; }
    const why = make('span', 'reason', r.reasons[0]);
    if (r.checked) why.append(make('small', '', ` Checked ${formatDate(r.checked)}.`));
    li.append(name, why);
    outList.append(li);
  }

  $('empty-state').hidden = shown > 0 || !items.length;
  $('ksn-note').hidden = !items.length || !(answers.needs.length === 0 || answers.needs.includes('money'));
  summarize(answers, shown, out.length);

  const hash = toHash(answers);
  if (hash !== window.location.hash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }
}

function summarize(answers, shown, out) {
  if (!items.length) return;
  const bits = [];
  if (answers.level) bits.push(answers.level);
  if (answers.citizen === 'yes') bits.push('citizen or PR');
  if (answers.citizen === 'no') bits.push('not citizen or PR');
  if (answers.needs.length) bits.push(answers.needs.map((n) => NEEDS.find((x) => x.id === n).label).join(', '));
  if (answers.kstate) bits.push('K-State only');
  const lead = bits.length ? `${bits.join(' · ')}: ` : 'Everything: ';
  $('answer-summary').textContent = `${lead}${shown} to look at${out ? `, ${out} ruled out` : ''}.`;
  $('results-bar-text').textContent = `${shown} to look at`;
  $('see-list').textContent = `See your list (${shown}) ↓`;
}

form.addEventListener('change', () => { expanded.clear(); render(); });
form.addEventListener('submit', (event) => event.preventDefault());
$('search').addEventListener('input', render);
$('kstate-only').addEventListener('change', () => { expanded.clear(); render(); });
$('clear-search').addEventListener('click', () => { $('search').value = ''; render(); $('search').focus(); });
$('start-over').addEventListener('click', () => {
  form.reset();
  $('kstate-only').checked = false;
  $('search').value = '';
  expanded.clear();
  render();
  form.querySelector('input[name="level"]').focus();
});
window.addEventListener('hashchange', () => { writeAnswers(fromHash(window.location.hash)); render(); });
// A page restored from the back-forward cache must not keep an old citizenship answer.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  for (const input of form.querySelectorAll('input[name="citizen"]')) input.checked = input.value === '';
  render();
});

// Sticky results shortcut for phones, and the big button under the questions:
// both offer a way down to the list.
function scrollToResults() {
  const smooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  $('results-title').scrollIntoView({ behavior: smooth, block: 'start' });
}
$('results-bar-go').addEventListener('click', scrollToResults);
$('see-list').addEventListener('click', scrollToResults);
if ('IntersectionObserver' in window) {
  const bar = $('results-bar');
  new IntersectionObserver((entries) => {
    bar.hidden = entries[0].isIntersecting || !items.length;
  }, { threshold: 0.08 }).observe($('results'));
}

async function load() {
  try {
    const get = async (path) => {
      const response = await fetch(new URL(path, import.meta.url), { cache: 'no-cache', credentials: 'omit' });
      if (!response.ok) throw new Error(path);
      return response.json();
    };
    const [catalogue, checks] = await Promise.all([get('../data/student-opportunities.json'), get('../data/eligibility-checks.json').catch(() => ({}))]);
    if (!Array.isArray(catalogue.opportunities) || !catalogue.opportunities.length) throw new Error('empty');
    items = mergeChecks(catalogue.opportunities, checks);
    const count = Object.keys(checks.entries || {}).length;
    if (count && checks.checked_on) $('checked-line').textContent = `${count} funding entries were checked on their official pages on ${formatDate(checks.checked_on)}.`;
    writeAnswers(fromHash(window.location.hash));
    render();
  } catch {
    $('answer-summary').textContent = 'The list could not be loaded.';
    $('data-error').textContent = window.location.protocol === 'file:'
      ? 'Open this page through a local server or GitHub Pages. From the site folder, run: node scripts/serve-student-match.mjs'
      : 'The list could not be loaded. Reload the page, or use the resource library linked below.';
    $('data-error').hidden = false;
  }
}
load();
