export const INTERESTS = ['Research', 'Scholarships', 'Travel', 'AI Tools', 'Free Software', 'Food', 'Financial Support', 'Career', 'Health', 'Learning'];
export const LEVELS = ['Undergraduate', "Master's", 'PhD', 'Postdoc', 'Other'];
export const STATUS_LABELS = {
  likely: 'Likely eligible',
  verify: 'Needs eligibility verification',
  ineligible: 'Not eligible based on supplied information',
};
export const CATEGORY_LABELS = {
  scholarships: 'Scholarships & fellowships', research: 'Research', 'ai-software': 'AI / Software',
  travel: 'Travel', 'campus-benefits': 'Campus & student resources', 'financial-support': 'Financial Support',
};
const tokens = text => [...new Set(String(text || '').toLowerCase().match(/[\p{L}][\p{L}\p{N}+#.-]{2,}/gu) || [])];
const stopwords = new Set(['and','the','for','with','from','that','this','student','students','university','state','kansas','interest','interests','research','skills','study']);
export function normalizeProfile(input = {}) {
  return {
    academic_level: LEVELS.includes(input.academic_level) ? input.academic_level : '',
    field: String(input.field || '').slice(0, 120).trim(),
    interests: [...new Set((input.interests || []).filter(x => INTERESTS.includes(x)))],
    student_status: ['international','domestic','prefer-not'].includes(input.student_status) ? input.student_status : '',
    enrolled: ['yes','no','prefer-not'].includes(input.enrolled) ? input.enrolled : '',
    skills: String(input.skills || '').slice(0, 500).trim(),
  };
}
export function evaluateOpportunity(opportunity, suppliedProfile, today = new Date().toISOString().slice(0, 10)) {
  const p = normalizeProfile(suppliedProfile);
  const missing = [...(opportunity.eligibility_rules?.unknown || [])];
  const conflicts = [], met = [];
  for (const rule of opportunity.eligibility_rules?.known || []) {
    const actual = p[rule.field];
    if (!actual || actual === 'prefer-not') { missing.push(`Not supplied: ${rule.label}`); continue; }
    const matches = rule.operator === 'in' ? rule.values.includes(actual) : rule.operator === 'equals' ? actual === rule.value : null;
    if (matches === null) missing.push(`Verify: ${rule.label}`);
    else if (matches) met.push(rule.label);
    else conflicts.push(`${rule.label}: the directory lists ${rule.values?.join(' or ') || rule.value}; you supplied ${actual}.`);
  }
  if (!opportunity.eligibility_rules?.complete && !missing.length) missing.push('Complete eligibility rules are unknown.');
  // A broad domestic/international answer is never evidence of citizenship,
  // nationality, residency, visa type, or other legal eligibility.
  if (opportunity.student_status_restrictions?.length) {
    if (!p.student_status || p.student_status === 'prefer-not') missing.push('Student status not supplied.');
    else if (!opportunity.student_status_restrictions.includes(p.student_status)) conflicts.push('The supplied student status is outside the explicitly listed student-status restriction.');
    else met.push('Explicit student-status restriction');
  }
  const expired = opportunity.availability?.state === 'past_cycle' ||
    Boolean(opportunity.availability?.reported_end && opportunity.availability.reported_end < today) ||
    Boolean(opportunity.deadline?.verified && opportunity.deadline.date && opportunity.deadline.date < today);
  const availability = expired ? 'past' : 'verify';
  const status = conflicts.length ? 'ineligible' : missing.length ? 'verify' : 'likely';
  let score = 0;
  const reasons = [];
  const common = p.interests.filter(t => opportunity.tags.includes(t));
  if (common.length) { score += common.length * 4; reasons.push(`Your interests: ${common.join(', ')}.`); }
  const haystack = tokens([opportunity.title, opportunity.description, opportunity.notes, ...opportunity.tags].join(' '));
  const keywords = tokens(`${p.field} ${p.skills}`).filter(t => !stopwords.has(t));
  const hits = keywords.filter(t => haystack.includes(t)).slice(0, 6);
  if (hits.length) { score += hits.length * 2; reasons.push(`Profile keywords: ${hits.join(', ')}.`); }
  if (p.academic_level && opportunity.academic_levels?.includes(p.academic_level)) { score += 2; reasons.push(`The directory describes support at your academic level (${p.academic_level}).`); }
  if (p.enrolled === 'yes' && opportunity.source?.categories.includes('kstate')) { score += 1; reasons.push('A K-State resource; you indicated current enrollment. Access still needs checking.'); }
  if (!reasons.length) reasons.push('Included for exploration; no specific relevance signal from your supplied profile.');
  return { opportunity, status, missing: [...new Set(missing)], conflicts, met, expired, availability, score, reasons,
    relevance: score >= 8 ? 'Strong relevance' : score > 0 ? 'Some relevance' : 'Explore',
    recommended: !expired && status !== 'ineligible' && score > 0 };
}
export function selectResults(evaluated, { category = 'all', query = '', scope = 'all', sort = 'relevance', eligibility = 'all' } = {}) {
  const q = query.toLowerCase().trim();
  const list = evaluated.filter(r => (category === 'all' || r.opportunity.categories.includes(category)) &&
    (scope !== 'recommended' || r.recommended) && (eligibility === 'all' || r.status === eligibility) &&
    (!q || [r.opportunity.title, r.opportunity.description, r.opportunity.notes, ...r.opportunity.tags].join(' ').toLowerCase().includes(q)));
  const priority = { likely: 0, verify: 1, ineligible: 2 };
  return list.sort((a,b) => {
    if (sort === 'title') return a.opportunity.title.localeCompare(b.opportunity.title);
    if (sort === 'eligibility') return priority[a.status] - priority[b.status] || Number(a.expired)-Number(b.expired) || b.score-a.score || a.opportunity.title.localeCompare(b.opportunity.title);
    if (sort === 'deadline') {
      const date = r => !r.expired && r.opportunity.deadline?.verified && r.opportunity.deadline.date ? r.opportunity.deadline.date : '9999';
      return date(a).localeCompare(date(b)) || a.opportunity.title.localeCompare(b.opportunity.title);
    }
    return Number(a.expired)-Number(b.expired) || priority[a.status]-priority[b.status] || b.score-a.score || a.opportunity.title.localeCompare(b.opportunity.title);
  });
}
// Only allowlisted, reviewable suggestions leave the document worker.
// No arbitrary CV passages, contact details, identifiers, or status inference.
export function suggestProfile(rawText) {
  const text = String(rawText).slice(0, 200000);
  const levels = [
    ['Undergraduate', /\b(?:current(?:ly)?\s+)?undergraduate student\b/i],
    ["Master's", /\bmaster(?:'s|s)? (?:student|candidate)\b/i],
    ['PhD', /\b(?:ph\.?d\.?|doctoral) (?:student|candidate)\b/i],
    ['Postdoc', /\bpostdoc(?:toral)? (?:researcher|fellow)\b/i],
  ].filter(([,pattern]) => pattern.test(text)).map(([level])=>level);
  const fields = ['Bioinformatics','Biology','Computer Science','Data Science','Agriculture','Chemistry','Physics','Engineering','Mathematics','Psychology','Business','Economics','Education','Architecture','Microbiology'];
  const foundFields = fields.filter(field => new RegExp(`\\b${field}\\b`, 'i').test(text));
  const skills = ['Python','R','SQL','JavaScript','MATLAB','GIS','Statistics','Genomics','Machine Learning','LaTeX','Microscopy','Writing','Teaching'];
  const foundSkills = skills.filter(skill=>new RegExp(`\\b${skill}\\b`, 'i').test(text));
  const interests = [];
  if (/\bresearch|laboratory|publication\b/i.test(text)) interests.push('Research');
  if (/\bscholarship|fellowship\b/i.test(text)) interests.push('Scholarships');
  if (/\bconference|poster presentation|travel\b/i.test(text)) interests.push('Travel');
  if (/\bartificial intelligence|machine learning\b/i.test(text)) interests.push('AI Tools');
  if (/\bprogramming|software|python|javascript\b/i.test(text)) interests.push('Free Software');
  return { academic_level: levels.length === 1 ? levels[0] : '', field: foundFields.length === 1 ? foundFields[0] : '', skills: foundSkills.join(', '), interests };
}
