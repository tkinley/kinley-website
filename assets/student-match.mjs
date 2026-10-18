import { INTERESTS, STATUS_LABELS, CATEGORY_LABELS, normalizeProfile, evaluateOpportunity, selectResults } from './student-match-engine.mjs';

const $ = id => document.getElementById(id);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
let opportunities = [], profile = normalizeProfile(), evaluated = [], visibleLimit = 24;
let filters = { category: 'all', query: '', scope: 'all', sort: 'relevance', eligibility: 'all' };
let parsingWorker = null, parseTimer = null, documentGeneration = 0, suggestions = null;
const derivedFields = new Map();
const profileFields = { academic_level: 'academic-level', field: 'major', skills: 'skills', student_status: 'student-status', enrolled: 'enrolled' };
for (const interest of INTERESTS) {
  const label = make('label', 'interest-chip');
  const input = document.createElement('input');
  input.type = 'checkbox'; input.name = 'interests'; input.value = interest;
  input.setAttribute('aria-label', interest);
  label.append(input, make('span', '', interest));
  $('interests').append(label);
}
function readProfile() {
  return normalizeProfile({ ...Object.fromEntries(Object.entries(profileFields).map(([key,id])=>[key,$(id).value])), interests: [...$('interests').querySelectorAll('input:checked')].map(x=>x.value) });
}
function stopWorker() {
  if (parsingWorker) parsingWorker.terminate();
  parsingWorker = null;
  clearTimeout(parseTimer); parseTimer = null;
  $('drop-zone').setAttribute('aria-busy', 'false');
}
function documentStatus(text, error = false) {
  $('document-status').textContent = text;
  $('document-status').classList.toggle('error', error);
}
function clearDocument(updateResults = true) {
  documentGeneration++;
  stopWorker();
  for (const [key, value] of derivedFields) {
    if (key === 'interests') {
      for (const checkbox of $('interests').querySelectorAll('input')) if (value.includes(checkbox.value)) checkbox.checked = false;
    } else if ($(profileFields[key]).value === value) $(profileFields[key]).value = '';
  }
  derivedFields.clear(); suggestions = null;
  $('document-input').value = '';
  $('suggestions').hidden = true; $('suggestion-list').replaceChildren();
  $('remove-document').hidden = true;
  $('use-suggestions').disabled = false;
  documentStatus('Document and its unedited suggestions removed. You can continue manually.');
  if (updateResults) { profile = readProfile(); evaluateAndRender(); }
}
function showSuggestions(value) {
  suggestions = value;
  const list = $('suggestion-list'); list.replaceChildren();
  for (const [label, answer] of [['Possible level', value.academic_level], ['Possible field', value.field], ['Skills / topics', value.skills], ['Interests', value.interests.join(', ')]]) {
    if (answer) list.append(make('dt', '', label), make('dd', '', answer));
  }
  const found = Boolean(list.childElementCount);
  $('suggestions').hidden = !found;
  documentStatus(found ? 'Read locally. The document text has been discarded. Review the suggestions below; no status or enrollment was inferred.' : 'Read locally, but no clear profile keywords were found. The text has been discarded. Enter your profile manually.');
}
async function processFile(file) {
  clearDocument();
  const generation = documentGeneration;
  $('remove-document').hidden = false;
  const format = file.name.toLowerCase().split('.').pop();
  if (!['pdf','docx'].includes(format)) { documentStatus('Please choose a PDF or DOCX. Other file types are not read. You can enter your profile manually.', true); return; }
  if (file.size > 8 * 1024 * 1024 || file.size === 0) { documentStatus('Choose a non-empty file up to 8 MB, or enter your profile manually.', true); return; }
  documentStatus('Reading locally… You can remove the document to cancel.');
  $('drop-zone').setAttribute('aria-busy', 'true');
  try {
    const buffer = await file.arrayBuffer();
    if (generation !== documentGeneration) return;
    const bytes = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    const signature = String.fromCharCode(...bytes);
    if ((format === 'pdf' && signature !== '%PDF-') || (format === 'docx' && (bytes[0] !== 0x50 || bytes[1] !== 0x4b))) throw new Error('format');
    parsingWorker = new Worker(new URL('./student-document-worker.js', import.meta.url));
    parsingWorker.onmessage = ({ data }) => {
      if (generation !== documentGeneration) return;
      if (typeof data?.ok !== 'boolean') return;
      stopWorker();
      if (data.ok) showSuggestions(data.suggestions);
      else documentStatus(data.code === 'no-text' ? 'No usable text was found. Scanned or image-only documents need a manual profile; no OCR or external service is used.' : data.code === 'complex' ? 'This document exceeds the local processing limits (30 PDF pages, 200,000 text characters, or 30 MB expanded DOCX). Please use a shorter file or enter your profile manually.' : 'This document could not be read. It may be damaged, encrypted, or unsupported. Try an unlocked PDF or DOCX, or enter your profile manually.', true);
    };
    parsingWorker.onerror = event => {
      event.preventDefault();
      if (generation !== documentGeneration) return;
      stopWorker(); documentStatus('The local parser could not start or read this document. Enter your profile manually. No document was uploaded.', true);
    };
    parseTimer = setTimeout(()=> {
      if (generation !== documentGeneration) return;
      stopWorker(); documentStatus('Local parsing timed out and was stopped. Try a simpler file or enter your profile manually.', true);
    }, 25000);
    parsingWorker.postMessage({ buffer, format }, [buffer]);
  } catch {
    if (generation !== documentGeneration) return;
    stopWorker(); documentStatus('This file could not be read as a PDF or DOCX. Check its format or enter your profile manually.', true);
  }
}
$('browse-files').addEventListener('click', ()=>$('document-input').click());
$('document-input').addEventListener('change', event => { const file = event.target.files[0]; if (file) processFile(file); });
for (const name of ['dragenter','dragover']) $('drop-zone').addEventListener(name, event=>{ event.preventDefault(); $('drop-zone').classList.add('drag-over'); });
for (const name of ['dragleave','drop']) $('drop-zone').addEventListener(name, event=>{ event.preventDefault(); $('drop-zone').classList.remove('drag-over'); });
$('drop-zone').addEventListener('drop', event=> {
  const files = event.dataTransfer.files;
  if (files.length === 1) processFile(files[0]);
  else documentStatus('Please select one PDF or DOCX at a time, or enter your profile manually.', true);
});
// Prevent an accidentally dropped document from navigating away from this page.
document.addEventListener('dragover', event=>event.preventDefault());
document.addEventListener('drop', event=>event.preventDefault());
$('skip-upload').addEventListener('click', ()=>{ $('profile-title').focus(); $('profile-title').scrollIntoView({ block:'start' }); });
$('remove-document').addEventListener('click', ()=>{ clearDocument(); $('browse-files').focus(); });
$('use-suggestions').addEventListener('click', ()=> {
  if (!suggestions) return;
  let applied = 0;
  for (const key of ['academic_level','field','skills']) {
    const control = $(profileFields[key]);
    if (!control.value && suggestions[key]) { control.value = suggestions[key]; derivedFields.set(key, suggestions[key]); applied++; }
  }
  if (!$('interests').querySelector('input:checked') && suggestions.interests.length) {
    for (const c of $('interests').querySelectorAll('input')) c.checked = suggestions.interests.includes(c.value);
    derivedFields.set('interests', [...suggestions.interests]); applied++;
  }
  $('profile-feedback').textContent = applied ? 'Suggestions added to blank fields. Review or edit them, then find your opportunities.' : 'Your existing answers were preserved. You can edit every field manually.';
  $('use-suggestions').disabled = true;
  $('profile-title').focus(); $('profile-title').scrollIntoView({ block:'start' });
});
for (const eventName of ['input','change']) $('profile-form').addEventListener(eventName, event=> {
  const key = Object.keys(profileFields).find(k=>profileFields[k]===event.target.id);
  if (key) derivedFields.delete(key);
  if (event.target.name === 'interests') {
    const derived = derivedFields.get('interests') || [];
    derivedFields.set('interests', derived.filter(x=>x!==event.target.value));
  }
  $('profile-feedback').textContent = 'Profile changed. Choose “Find my opportunities” to update your results.';
});
function evaluateAndRender() {
  evaluated = opportunities.map(o=>evaluateOpportunity(o, profile));
  for (const key of ['likely','verify','ineligible']) $(`${key}-count`).textContent = evaluated.filter(r=>r.status===key).length;
  renderResults();
}
function setScope(scope) {
  filters.scope = scope;
  $('view-recommended').setAttribute('aria-pressed', String(scope==='recommended'));
  $('view-all').setAttribute('aria-pressed', String(scope==='all'));
}
function resetFilters() {
  filters = { category:'all', query:'', scope:'all', sort:'relevance', eligibility:'all' };
  $('resource-search').value = ''; $('sort-order').value = 'relevance'; $('eligibility-filter').value = 'all';
  for (const b of $('category-filters').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.category==='all'));
  setScope('all'); visibleLimit = 24;
}
function goToResults() { $('results-title').focus(); $('results-title').scrollIntoView({ block:'start' }); }
$('profile-form').addEventListener('submit', event=> {
  event.preventDefault(); profile = readProfile(); resetFilters();
  const hasSignals = profile.interests.length || profile.field || profile.skills || profile.academic_level || profile.enrolled==='yes';
  const hasRecommendations = hasSignals && opportunities.some(o=>evaluateOpportunity(o,profile).recommended);
  setScope(hasRecommendations ? 'recommended' : 'all');
  $('results-description').textContent = hasRecommendations ? 'Ranked by your supplied profile. Review eligibility separately before applying.' : 'No specific relevance matches yet. Explore the full directory, or add interests to personalize it. Missing answers remain unknown.';
  $('profile-feedback').textContent = 'Results updated from the answers shown above. Your profile is only in this tab.';
  evaluateAndRender(); goToResults();
});
$('browse-all').addEventListener('click', ()=> { profile = readProfile(); resetFilters(); evaluateAndRender(); goToResults(); });
$('reset-all').addEventListener('click', ()=> {
  clearDocument(false); $('profile-form').reset(); derivedFields.clear(); profile = normalizeProfile(); resetFilters();
  documentStatus('Your document stays on this device. It is never uploaded.');
  $('profile-feedback').textContent = 'Everything has been reset. No document or profile is retained by the matcher.';
  $('results-description').textContent = 'Browse the directory now, or add a profile to personalize the order.';
  evaluateAndRender(); $('profile-title').focus();
});
function card(result) {
  const { opportunity:o } = result;
  const article = make('article','resource-card'); article.dataset.id = o.id;
  const h3 = make('h3','',o.title); h3.id = `title-${o.id}`; article.setAttribute('aria-labelledby',h3.id);
  article.append(make('p','card-eyebrow',CATEGORY_LABELS[o.category] || o.category));
  const heading = make('div','card-heading'); heading.append(h3,make('span','card-relevance',result.relevance)); article.append(heading);
  article.append(make('p','source-label','DIRECTORY SUMMARY · UNVERIFIED'),make('p','description',o.description));
  article.append(make('span',`eligibility-badge ${result.status}`,STATUS_LABELS[result.status]));
  article.append(make('p',`availability${result.expired?' past':''}`,result.expired ? 'Past listed cycle / deadline · current availability unverified' : 'Verification needed · current availability unknown'));
  if (result.conflicts.length) { const ul = make('ul','conflict-list'); for (const c of result.conflicts) ul.append(make('li','',c)); article.append(ul); }
  const why = make('div','why'); why.append(make('h4','', 'Why it matches · relevance only'));
  const ul = make('ul'); for (const reason of result.reasons) ul.append(make('li','',reason)); why.append(ul); article.append(why);
  const missing = make('div','missing'); missing.append(make('h4','', 'Missing eligibility information'),make('p','',result.missing[0] || 'No missing information in the documented rules; confirm current terms.')); article.append(missing);
  article.append(make('p','deadline-line',o.deadline?.verified && o.deadline.date ? `Verified deadline: ${o.deadline.date}` : 'Deadline: Verification needed'));
  const details = document.createElement('details'); details.append(make('summary','', 'Original notes & eligibility checks'));
  details.append(make('p','',`Original notes (unverified): ${o.notes}`));
  details.append(make('p','',`Original benefit label (unverified): ${o.benefit_type}`));
  if (o.deadline?.source_text) details.append(make('p','',`Reported timing (unverified; not a confirmed deadline): ${o.deadline.source_text}`));
  const checks = make('ul'); for (const item of result.missing) checks.append(make('li','',item)); details.append(checks);
  if (result.met.length) details.append(make('p','',`Supplied answers align with: ${result.met.join('; ')}. This does not establish complete eligibility.`));
  details.append(make('p','','No student-status restriction is established unless explicitly recorded. Domestic/international labels never establish citizenship or residency.'));
  article.append(details);
  const footer = make('div','card-footer');
  try { const url = new URL(o.official_url); if (!['http:','https:'].includes(url.protocol)) throw new Error('url'); const link = make('a','','Check official resource ↗'); link.href = o.official_url; link.target = '_blank'; link.rel='noopener noreferrer'; link.setAttribute('aria-label',`Check official resource: ${o.title} (opens in new tab)`); footer.append(link); } catch { footer.append(make('span','','Resource link unavailable')); }
  footer.append(make('small','',`Last verified: ${o.last_verified || 'Unknown'}`)); article.append(footer);
  return article;
}
function renderResults() {
  const list = selectResults(evaluated, filters);
  const shown = list.slice(0, visibleLimit);
  const fragment = document.createDocumentFragment(); shown.forEach(r=>fragment.append(card(r))); $('resource-grid').replaceChildren(fragment);
  $('result-count').textContent = `Showing ${shown.length} of ${list.length} ${filters.scope==='recommended'?'recommended opportunities':'opportunities'} · ${opportunities.length} in the directory`;
  if (filters.sort==='deadline' && !list.some(r=>!r.expired && r.opportunity.deadline?.verified && r.opportunity.deadline.date)) $('result-count').textContent += ' · No verified upcoming deadlines; sorted by name';
  $('empty-state').hidden = list.length > 0 || opportunities.length === 0;
  $('show-more').hidden = shown.length >= list.length;
  $('show-more').textContent = `Show ${Math.min(24, list.length-shown.length)} more resources`;
}
$('category-filters').addEventListener('click', event=> {
  const button = event.target.closest('button[data-category]'); if (!button) return;
  filters.category = button.dataset.category;
  for (const b of $('category-filters').querySelectorAll('button')) b.setAttribute('aria-pressed',String(b===button));
  visibleLimit=24; renderResults();
});
$('resource-search').addEventListener('input',()=>{ filters.query=$('resource-search').value; visibleLimit=24; renderResults(); });
$('sort-order').addEventListener('change',()=>{ filters.sort=$('sort-order').value; visibleLimit=24; renderResults(); });
$('eligibility-filter').addEventListener('change',()=>{ filters.eligibility=$('eligibility-filter').value; visibleLimit=24; renderResults(); });
for (const scope of ['all','recommended']) $(`view-${scope}`).addEventListener('click',()=>{ setScope(scope); visibleLimit=24; renderResults(); });
$('clear-filters').addEventListener('click',()=>{ resetFilters(); renderResults(); $('resource-search').focus(); });
$('show-more').addEventListener('click',()=>{ const previous=visibleLimit; visibleLimit+=24; renderResults(); const next=$('resource-grid').children[previous]?.querySelector('summary'); next?.focus(); });
window.addEventListener('pagehide',()=>{ stopWorker(); suggestions=null; profile=normalizeProfile(); derivedFields.clear(); });
// A restored back-forward-cache page must not restore a previous private profile.
window.addEventListener('pageshow',event=>{ if(event.persisted) $('reset-all').click(); });
async function loadData() {
  $('match-button').disabled = true;
  try {
    const response = await fetch(new URL('../data/student-opportunities.json', import.meta.url), { cache:'no-store', credentials:'omit' });
    if (!response.ok) throw new Error('data');
    const data = await response.json();
    if (!Array.isArray(data.opportunities) || !data.opportunities.length) throw new Error('data');
    opportunities = data.opportunities;
    $('directory-count').textContent = `${opportunities.length} resources · one place`;
    evaluateAndRender();
  } catch {
    $('result-count').textContent='The local directory could not be loaded.';
    $('data-error').textContent=window.location.protocol==='file:' ? 'Open this page through a local HTTP server or GitHub Pages. From this folder, run: node scripts/serve-student-match.mjs. You can also use the original resource directory linked above.' : 'The resource list could not be loaded. Reload this page, or use the original resource directory linked above. Your document and profile have not been uploaded.';
    $('data-error').hidden=false;
  } finally { $('match-button').disabled = opportunities.length===0; }
}
loadData();
