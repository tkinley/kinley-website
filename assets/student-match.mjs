import { INTERESTS, STATUS_LABELS, CATEGORY_LABELS, normalizeProfile, evaluateOpportunity, selectResults } from './student-match-engine.mjs?v=3';

const $ = id => document.getElementById(id);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const PAGE_SIZE = 12;
let opportunities = [], profile = normalizeProfile(), evaluated = [], visibleLimit = PAGE_SIZE;
let filters = { category: 'all', query: '', scope: 'all', sort: 'relevance', eligibility: 'all', interest: '' };
const TOPIC_TITLES = { Food: 'Free food resources', Scholarships: 'Scholarships & funding', 'Free Software': 'Software & student tools', Research: 'Research opportunities', Travel: 'Travel grants & resources' };
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
  const activeProfile = filters.interest ? { ...profile, interests: [...profile.interests, filters.interest] } : profile;
  evaluated = opportunities.map(o=>evaluateOpportunity(o, activeProfile));
  for (const key of ['likely','verify','ineligible']) $(`${key}-count`).textContent = evaluated.filter(r=>r.status===key).length;
  renderResults();
}
function setScope(scope) {
  filters.scope = scope;
  $('view-recommended').setAttribute('aria-pressed', String(scope==='recommended'));
  $('view-all').setAttribute('aria-pressed', String(scope==='all'));
}
function resetFilters() {
  filters = { category:'all', query:'', scope:'all', sort:'relevance', eligibility:'all', interest:'' };
  $('resource-search').value = ''; $('sort-order').value = 'relevance'; $('eligibility-filter').value = 'all';
  for (const b of $('category-filters').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.category==='all'));
  setScope('all'); visibleLimit = PAGE_SIZE;
}
function updateTopicUI() {
  for (const button of document.querySelectorAll('button[data-interest]')) button.setAttribute('aria-pressed', String(button.dataset.interest===filters.interest));
  $('clear-topic').hidden = !filters.interest;
  $('clear-topic').textContent = filters.interest ? `${filters.interest==='Food'?'Free food':filters.interest} ×` : '';
  $('clear-topic').setAttribute('aria-label', `Clear ${filters.interest || 'topic'} filter`);
}
for (const button of document.querySelectorAll('button[data-interest]')) button.addEventListener('click',()=> {
  resetFilters(); filters.interest = button.dataset.interest;
  $('results-title').textContent = TOPIC_TITLES[filters.interest] || 'Student opportunities';
  $('results-description').textContent = '';
  evaluateAndRender(); goToResults();
});
function exploreEverything() {
  resetFilters(); $('results-title').textContent='Opportunities';
  $('results-description').textContent='';
  evaluateAndRender(); goToResults();
}
$('explore-all').addEventListener('click', exploreEverything);
$('explore-deadlines').addEventListener('click',()=> {
  resetFilters(); filters.sort='deadline'; $('sort-order').value='deadline';
  $('results-title').textContent='Find by deadline';
  $('results-description').textContent='Confirmed upcoming deadlines first.';
  evaluateAndRender(); goToResults();
});
$('clear-topic').addEventListener('click',()=> {
  filters.interest=''; visibleLimit=PAGE_SIZE; $('results-title').textContent='Opportunities';
  $('results-description').textContent='';
  evaluateAndRender(); $('resource-search').focus();
});
$('open-profile').addEventListener('click',()=> {
  $('personalize').open=true;
  $('personalize').querySelector('summary').focus();
  $('personalize').scrollIntoView({block:'start'});
});
$('personalize').addEventListener('toggle',()=> $('open-profile').setAttribute('aria-expanded',String($('personalize').open)));
function goToResults() { $('results-title').focus(); $('results-title').scrollIntoView({ block:'start' }); }
$('profile-form').addEventListener('submit', event=> {
  event.preventDefault(); profile = readProfile(); resetFilters();
  const hasSignals = profile.interests.length || profile.field || profile.skills || profile.academic_level || profile.enrolled==='yes';
  const hasRecommendations = hasSignals && opportunities.some(o=>evaluateOpportunity(o,profile).recommended);
  $('results-title').textContent='Your opportunity matches';
  setScope(hasRecommendations ? 'recommended' : 'all');
  $('results-description').textContent = hasRecommendations ? 'Based on your profile. Check eligibility before applying.' : 'No specific relevance matches yet. Try adding interests.';
  $('profile-feedback').textContent = 'Results updated from the answers shown above. Your profile is only in this tab.';
  evaluateAndRender(); goToResults();
});
$('browse-all').addEventListener('click', ()=> { profile = readProfile(); exploreEverything(); });
$('reset-all').addEventListener('click', ()=> {
  clearDocument(false); $('profile-form').reset(); derivedFields.clear(); profile = normalizeProfile(); resetFilters();
  documentStatus('Your document stays on this device. It is never uploaded.');
  $('profile-feedback').textContent = 'Everything has been reset. No document or profile is retained by the matcher.';
  $('results-title').textContent='Opportunities';
  $('results-description').textContent = '';
  evaluateAndRender(); $('profile-title').focus();
});
function card(result) {
  const { opportunity:o } = result;
  const article = make('article','resource-card'); article.dataset.id = o.id;
  const h3 = make('h3','',o.title); h3.id = `title-${o.id}`; article.setAttribute('aria-labelledby',h3.id);
  article.append(make('p','card-eyebrow',CATEGORY_LABELS[o.category] || o.category));
  article.append(h3);
  const summary=o.description.length>150 ? o.description.slice(0,147).replace(/\s+\S*$/,'')+'…' : o.description;
  article.append(make('p','description',summary));
  article.append(make('span',`eligibility-badge ${result.status}`,STATUS_LABELS[result.status]));
  if(result.expired) article.append(make('p','availability past','Past listed cycle'));
  if(o.deadline?.verified && o.deadline.date) article.append(make('p','deadline-line',`Deadline: ${o.deadline.date}`));
  const details = document.createElement('details');
  const disclosure=make('summary','','Details');disclosure.setAttribute('aria-label',`Eligibility and matching details: ${o.title}`);details.append(disclosure);
  if(summary!==o.description) details.append(make('p','',o.description));
  details.append(make('p','',`Eligibility: ${STATUS_LABELS[result.status]}`));
  details.append(make('p','',`Availability: ${result.expired?'Past listed cycle; a new call is not established.':result.availability==='current'?'Current call reviewed; confirm before applying.':'Unverified. Check the official site.'}`));
  details.append(make('h4','','Why it matches'));
  const ul=make('ul');for(const reason of result.reasons)ul.append(make('li','',reason));details.append(ul);
  if(result.conflicts.length) { const conflicts=make('ul','conflict-list');for(const conflict of result.conflicts)conflicts.append(make('li','',conflict));details.append(conflicts); }
  details.append(make('h4','','Eligibility to check'));
  if (o.deadline?.source_text) details.append(make('p','',`Reported timing (unverified; not a confirmed deadline): ${o.deadline.source_text}`));
  const checks = make('ul'); for (const item of result.missing) checks.append(make('li','',item)); details.append(checks);
  details.append(make('p','',`Notes: ${o.notes}`));
  details.append(make('p','',`Benefit / amount: ${o.benefit_type}`));
  if(!o.deadline?.verified) details.append(make('p','','Deadline: Not verified.'));
  details.append(make('p','',`Last checked: ${o.last_verified || 'Unknown'}`));
  if (result.met.length) details.append(make('p','',`Supplied answers align with: ${result.met.join('; ')}. This does not establish complete eligibility.`));
  if(o.source?.file==='student-funding-updates.json') details.append(make('p','','Source: updated funding tracker and the linked issuer.'));
  article.append(details);
  const footer = make('div','card-footer');
  try { const url = new URL(o.official_url); if (!['http:','https:'].includes(url.protocol)) throw new Error('url'); const link = make('a','','Official site ↗'); link.href = o.official_url; link.target = '_blank'; link.rel='noopener noreferrer'; link.setAttribute('aria-label',`Official site: ${o.title} (opens in new tab)`); footer.append(link); } catch { footer.append(make('span','','Link unavailable')); }
  footer.append(make('small','',o.last_verified?`Checked ${o.last_verified}`:'Availability unverified')); article.append(footer);
  return article;
}
function renderResults() {
  updateTopicUI();
  const list = selectResults(evaluated, filters);
  const shown = list.slice(0, visibleLimit);
  const fragment = document.createDocumentFragment(); shown.forEach(r=>fragment.append(card(r))); $('resource-grid').replaceChildren(fragment);
  $('result-count').textContent = `${shown.length} of ${list.length} ${filters.scope==='recommended'?'matches':'opportunities'}`;
  if (filters.sort==='deadline' && !list.some(r=>!r.expired && r.opportunity.deadline?.verified && r.opportunity.deadline.date)) $('result-count').textContent += ' · No verified dates; alphabetical.';
  $('empty-state').hidden = list.length > 0 || opportunities.length === 0;
  $('show-more').hidden = shown.length >= list.length;
  $('show-more').textContent = `Show ${Math.min(PAGE_SIZE, list.length-shown.length)} more`;
}
$('category-filters').addEventListener('click', event=> {
  const button = event.target.closest('button[data-category]'); if (!button) return;
  filters.category = button.dataset.category;
  for (const b of $('category-filters').querySelectorAll('button')) b.setAttribute('aria-pressed',String(b===button));
  visibleLimit=PAGE_SIZE; renderResults();
});
$('resource-search').addEventListener('input',()=>{ filters.query=$('resource-search').value; visibleLimit=PAGE_SIZE; renderResults(); });
$('sort-order').addEventListener('change',()=>{ filters.sort=$('sort-order').value; visibleLimit=PAGE_SIZE; renderResults(); });
$('eligibility-filter').addEventListener('change',()=>{ filters.eligibility=$('eligibility-filter').value; visibleLimit=PAGE_SIZE; renderResults(); });
for (const scope of ['all','recommended']) $(`view-${scope}`).addEventListener('click',()=>{ setScope(scope); visibleLimit=PAGE_SIZE; renderResults(); });
$('clear-filters').addEventListener('click',()=>{ resetFilters(); $('results-title').textContent='Student opportunities'; evaluateAndRender(); $('resource-search').focus(); });
$('show-more').addEventListener('click',()=>{ const previous=visibleLimit; visibleLimit+=PAGE_SIZE; renderResults(); const next=$('resource-grid').children[previous]?.querySelector('summary'); next?.focus(); });
window.addEventListener('pagehide',()=>{ stopWorker(); suggestions=null; profile=normalizeProfile(); derivedFields.clear(); });
// A restored back-forward-cache page must not restore a previous private profile.
window.addEventListener('pageshow',event=>{ if(event.persisted) $('reset-all').click(); });
async function loadData() {
  $('match-button').disabled = true;
  for (const button of document.querySelectorAll('[data-interest], #explore-deadlines, #explore-all')) button.disabled=true;
  try {
    const response = await fetch(new URL('../data/student-opportunities.json', import.meta.url), { cache:'no-store', credentials:'omit' });
    if (!response.ok) throw new Error('data');
    const data = await response.json();
    if (!Array.isArray(data.opportunities) || !data.opportunities.length) throw new Error('data');
    opportunities = data.opportunities;
    $('directory-count').textContent = `${opportunities.length} resources`;
    evaluateAndRender();
  } catch {
    $('result-count').textContent='The local directory could not be loaded.';
    $('data-error').textContent=window.location.protocol==='file:' ? 'Open this page through a local HTTP server or GitHub Pages. From this folder, run: node scripts/serve-student-match.mjs. You can also use the original resource directory linked below.' : 'The resource list could not be loaded. Reload this page, or use the original resource directory linked below. Your document and profile have not been uploaded.';
    $('data-error').hidden=false;
  } finally {
    $('match-button').disabled = opportunities.length===0;
    for (const button of document.querySelectorAll('[data-interest], #explore-deadlines, #explore-all')) button.disabled=opportunities.length===0;
  }
  if(opportunities.length && window.location.hash==='#scholarships') document.querySelector('.quick-choice[data-interest="Scholarships"]').click();
}
loadData();
