import { NEEDS, GROUPS, KIND_LABELS, mergeChecks, groupResults, deadlineText, formatDate, localToday, toHash, fromHash } from './student-match-engine.mjs?v=12';

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

function render(animate = false) {
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
    (open ? list : list.slice(0, PREVIEW)).forEach((r, i) => {
      const node = card(r);
      if (animate) { node.classList.add('enter'); node.style.setProperty('--i', String(Math.min(i, 8))); }
      grid.append(node);
    });
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

  const hash = hashFor(answers, view);
  if (hash !== window.location.hash) history.replaceState(history.state, '', urlFor(hash));
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
  const chips = $('answer-chips');
  chips.replaceChildren(...(bits.length ? bits : ['Everything']).flatMap((b) => b.split(', ')).map((b) => make('span', 'chip', b)));
  $('list-count').textContent = `${shown} ${shown === 1 ? 'result' : 'results'}${out ? ` · ${out} ruled out` : ''}`;
  updateCounts(shown);
}

form.addEventListener('change', (event) => { if (event.target.name) touched.add(event.target.name); expanded.clear(); render(); });
// Tapping the already-selected "Skip" fires no change event, but it still answers question 2.
form.addEventListener('click', (event) => {
  if (event.target.name === 'citizen' && !touched.has('citizen')) { touched.add('citizen'); updateTaps(); }
});
form.addEventListener('submit', (event) => { event.preventDefault(); showList(); });
$('search').addEventListener('input', render);
$('kstate-only').addEventListener('change', () => { expanded.clear(); render(); });
$('clear-search').addEventListener('click', () => { $('search').value = ''; render(); $('search').focus(); });
$('start-over').addEventListener('click', () => {
  touched.clear();
  form.reset();
  $('kstate-only').checked = false;
  $('search').value = '';
  expanded.clear();
  render();
  form.querySelector('input[name="level"]').focus();
});
window.addEventListener('popstate', syncFromLocation);
window.addEventListener('hashchange', syncFromLocation);
// A page restored from the back-forward cache must not keep an old citizenship answer.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  for (const input of form.querySelectorAll('input[name="citizen"]')) input.checked = input.value === '';
  render();
});

// Two views on one page: the questions, then the list. Going to the list adds
// a history entry, so the browser's Back button returns to the questions.
// The hash carries "list" plus level and needs; citizenship never goes there.
let view = 'ask';
let lastShown = null;
const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
const urlFor = (hash) => `${window.location.pathname}${window.location.search}${hash}`;

function hashFor(answers, which) {
  const rest = toHash(answers).slice(1);
  const parts = which === 'list' ? ['list', rest] : [rest];
  const joined = parts.filter(Boolean).join('&');
  return joined ? `#${joined}` : '';
}

function wantsList(hash) {
  const raw = String(hash).replace(/^#/, '');
  return raw === 'scholarships' || new URLSearchParams(raw).has('list');
}

// The Show button is the page's one bit of play. Three dots fill as each
// question gets an answer ("three taps"), the count rolls like an odometer
// when it changes, and a light sweeps across once all three are answered.
const touched = new Set();
function updateCounts(shown) {
  const noun = shown === 1 ? 'result' : 'results';
  $('see-label').textContent = `Show ${shown} ${noun}`;
  $('go-noun').textContent = noun;
  setOdometer($('odo'), shown);
  lastShown = shown;
  updateTaps();
}

function setOdometer(node, value) {
  const digits = String(value).split('').map(Number);
  while (node.children.length < digits.length) {
    const wheel = make('span', 'wheel');
    const strip = make('span', 'strip');
    for (let d = 0; d <= 9; d += 1) strip.append(make('span', '', String(d)));
    wheel.append(strip);
    node.prepend(wheel);
  }
  while (node.children.length > digits.length) node.firstElementChild.remove();
  [...node.children].forEach((wheel, i) => wheel.firstElementChild.style.setProperty('--d', String(digits[i])));
}

function updateTaps() {
  const answers = readAnswers();
  const done = {
    level: Boolean(answers.level),
    citizen: Boolean(answers.citizen) || touched.has('citizen'),
    needs: answers.needs.length > 0,
  };
  for (const dot of document.querySelectorAll('.taps i')) dot.classList.toggle('on', done[dot.dataset.q]);
  const ready = done.level && done.citizen && done.needs;
  const button = $('see-list');
  if (ready && !button.classList.contains('ready')) restart(button, 'shine');
  button.classList.toggle('ready', ready);
}

function setView(next, { focus = true } = {}) {
  if (next === view && !$(next).hidden) return;
  view = next;
  $('ask').hidden = next !== 'ask';
  $('list').hidden = next !== 'list';
  document.body.dataset.view = next;
  window.scrollTo(0, 0);
  restart($(next), 'entering');
  if (next === 'list') {
    expanded.clear();
    render(true);
    restart(document.querySelector('.results-head'), 'arrived');
    if (focus) $('results-title').focus({ preventScroll: true });
  } else {
    render();
    if (focus) $('see-list').focus({ preventScroll: true });
  }
}

function showList() {
  if (!items.length) return;
  history.pushState({ view: 'list' }, '', urlFor(hashFor(readAnswers(), 'list')));
  setView('list');
}

function showAsk() {
  if (history.state?.view === 'list') history.back();
  else { history.replaceState(null, '', urlFor(hashFor(readAnswers(), 'ask'))); setView('ask'); }
}

function syncFromLocation() {
  if (!items.length) return;
  const hash = window.location.hash;
  if (hash === '#main') return;
  writeAnswers(fromHash(hash));
  setView(wantsList(hash) ? 'list' : 'ask', { focus: false });
  render();
}

$('back').addEventListener('click', showAsk);
$('to-top').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
for (const preset of document.querySelectorAll('.preset')) {
  preset.addEventListener('click', () => {
    writeAnswers({ level: preset.dataset.level || '', needs: (preset.dataset.needs || '').split(',').filter(Boolean), kstate: false });
    showList();
  });
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
    view = '';
    setView(wantsList(window.location.hash) ? 'list' : 'ask', { focus: false });
  } catch {
    $('answer-summary').textContent = 'The list could not be loaded.';
    $('data-error').textContent = window.location.protocol === 'file:'
      ? 'Open this page through a local server or GitHub Pages. From the site folder, run: node scripts/serve-student-match.mjs'
      : 'The list could not be loaded. Reload the page, or use the resource library linked below.';
    $('data-error').hidden = false;
  }
}
load();
