// Reproducible conversion of the original cards. No live verification is implied.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const html = await readFile(new URL('../student-benefits.html', import.meta.url), 'utf8');
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', middot: '·', ndash: '–', mdash: '—' };
const plain = s => s.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' ? 2 : 1), e[1] === 'x' ? 16 : 10)) : entities[e] ?? m).replace(/\s+/g, ' ').trim();
const funding = new Set([16,17,18,26,50,51,64,65,66,67,68,69,70,71,72,73,74,75]);
const travel = new Set([17,26,50,64,65,66,67,68,70,71,72,73,74,104]);
const software = new Set([1,5,6,9,11,12,13,14,15,19,22,27,35,36,37,43,44,47,48,49,55,76,78,79,80,81,82,83,84,85,91]);
const levelRules = {
  17: ['PhD'], 18: ['PhD'], 51: ['PhD'], 69: ["Master's", 'PhD'],
  72: ["Master's", 'PhD'],
};
const enrollmentRules = new Set([1,8]); // Only where the original explicitly says enrolled / credit hours.
const unknowns = {
  7: ['Eligible researcher affiliation and annual account renewal'],
  8: ['At least one credit hour and semester registration on the official site'],
  16: ['US citizenship, nationality, or permanent residency (student status alone does not establish this)', 'First/second-year and current discipline-specific application rules'],
  17: ['PhD candidacy and a DOE laboratory collaborator'],
  18: ['Dissertation stage and current NIH institute/notice requirements'],
  26: ['Graduate enrollment, event eligibility, award limits, and advance application timing'],
  38: ['Campus privilege fee and service-specific access requirements'],
  50: ['Current grant cycle, research purpose, and membership-dependent funding caps'],
  51: ['PhD candidacy and US citizenship or permanent residency (not inferred from student status)', 'Current agricultural research scope'],
  61: ['Parent/caregiver eligibility, child age, subsidy criteria, fees, and space'],
  64: ['PhD student OR recent degree, FEMS membership, and host country requirements'],
  65: ['Presenting-author status, career stage, membership, and qualifying meeting'],
  66: ['Early career, first-author/presenter status, and current call'],
  68: ['FEMS Full Member Society membership and current award cycle'],
  70: ['First-time GRC attendance and conference-specific rules'],
  71: ['Admission to a German or bi-national doctoral programme and current provider requirements; a doctoral award does not imply applicants must already be PhD students'],
  72: ['US eligibility definition, language study, destination, and federal-service commitment'],
  73: ['Current cycle, citizenship rules, degree requirements, and campus deadline'],
  74: ['Agreement with an EMBL host and current call'],
  75: ['An already awarded PhD (current academic level does not establish an earned degree)', 'Research recency and current competition'],
  100: ['Affordability and household-income criteria on the provider site'],
  104: ['Membership, location, and separate time-limited J1 offer terms; visa status is never inferred'],
};
const cards = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)];
const opportunities = cards.map(([, attrs, body], index) => {
  const n = index + 1;
  const title = plain(body.match(/<h3>([\s\S]*?)<\/h3>/)[1]);
  const description = plain(body.match(/<p>([\s\S]*?)<\/p>/)[1]);
  const notes = plain(body.match(/<div class="details">([\s\S]*?)<\/div>/)[1]);
  const sourceCategories = attrs.match(/data-cat="([^"]*)"/)[1].split(' ');
  const labels = [...body.matchAll(/<span class="tag[^\"]*">([\s\S]*?)<\/span>/g)].map(m => plain(m[1]));
  const categories = [];
  if (funding.has(n)) categories.push('scholarships');
  if (sourceCategories.includes('research') || (funding.has(n) && n !== 26)) categories.push('research');
  if (sourceCategories.includes('ai') || software.has(n)) categories.push('ai-software');
  if (travel.has(n)) categories.push('travel');
  if (sourceCategories.includes('kstate') || sourceCategories.includes('fun') || sourceCategories.includes('learn')) categories.push('campus-benefits');
  if (sourceCategories.includes('money') || funding.has(n)) categories.push('financial-support');
  if (!categories.length) categories.push('campus-benefits');
  const tags = new Set();
  for (const [cat, interest] of [['research','Research'],['scholarships','Scholarships'],['travel','Travel'],['financial-support','Financial Support']]) if (categories.includes(cat)) tags.add(interest);
  if (sourceCategories.includes('ai')) tags.add('AI Tools');
  if (software.has(n) || sourceCategories.includes('ai')) tags.add('Free Software');
  if (sourceCategories.includes('learn') || [31,35,41,52,55,56,95,96,97,98,99].includes(n)) tags.add('Learning');
  if ([8,29].includes(n)) tags.add('Food');
  if ([23,35,54,62,95,96,97,98,99].includes(n)) tags.add('Career');
  if ([25,100,101,102,105,106].includes(n)) tags.add('Health');
  // Search/relevance vocabulary only; these tags never establish eligibility.
  for (const [pattern, terms] of [[/genom|microb|plasmid|protein|bioinform|fung|life science/i,['biology','bioinformatics']], [/python|SQL|coding|cloud|GPU|ML|data|stats|modelling/i,['computer science','data science']], [/ag, food|agricultur/i,['agriculture']]]) if (pattern.test(title+' '+description+' '+notes)) terms.forEach(t=>tags.add(t));
  const known = [];
  if (levelRules[n]) known.push({ field: 'academic_level', operator: 'in', values: levelRules[n], label: 'Academic stage described in the directory', source_text: title+' — '+description+' '+notes });
  if (enrollmentRules.has(n)) known.push({ field: 'enrolled', operator: 'equals', value: 'yes', label: 'Current K-State enrollment', source_text: n===1 ? description : notes });
  let reportedDate = null;
  if (n===16) reportedDate='2026-10-19';
  if (n===66) reportedDate='2026-12-15';
  if (n===69) reportedDate='2026-02-01';
  if (n===73) reportedDate='2026-10-06';
  const deadlineLabel = labels.filter(x=>/Deadline|Jan |Feb |Mar |Sep |Oct |Nov |Dec |cycle|conference|Campus|Watchlist|See |Live:/.test(x));
  return {
    id: title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
    title, description, category: categories[0], categories,
    benefit_type: labels.filter(x=>x!=='K-State').join(' · ') || 'Not specified in source',
    official_url: body.match(/href="([^"]*)"/)[1].replace(/&amp;/g,'&'),
    eligibility_rules: { known, unknown: [...(unknowns[n] || []), 'Complete current eligibility and access terms have not been verified'], complete: false },
    academic_levels: levelRules[n] || null,
    student_status_restrictions: null,
    deadline: { date: null, verified: false, reported_date: reportedDate, source_text: [...deadlineLabel, ...(/deadline|due |cycles|cycle|submissions|through Dec/i.test(notes) ? [notes] : [])].join(' · ') || null },
    last_verified: null, tags: [...tags], notes,
    availability: { state: [69,73].includes(n) ? 'past_cycle' : 'verification_needed', reported_end: reportedDate },
    source: { file: 'student-benefits.html', card_number: n, categories: sourceCategories, labels },
  };
});
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
const updates = JSON.parse(await readFile(new URL('../data/student-funding-updates.json', import.meta.url),'utf8'));
for (const update of updates.opportunities) {
  const index = update.replaces_id ? opportunities.findIndex(o=>o.id===update.replaces_id) : -1;
  if (update.replaces_id && index<0) throw new Error(`Missing original card: ${update.replaces_id}`);
  if (index>=0) {
    const original=opportunities[index];
    opportunities[index]={...update,id:original.id,categories:[...new Set([...original.categories,...update.categories])],tags:[...new Set([...original.tags,...update.tags])],original_card:original};
  } else {
    if(opportunities.some(o=>o.id===update.id)) throw new Error(`Duplicate opportunity: ${update.id}`);
    opportunities.push(update);
  }
}
await writeFile(new URL('../data/student-opportunities.json', import.meta.url), JSON.stringify({ schema_version: 2, sources: ['student-benefits.html','student-funding-updates.json'], original_card_count:cards.length, funding_record_count:updates.opportunities.length, verification_note: 'Null means unknown. Workbook fit scores and personal tracking notes are excluded. Only explicitly reviewed official information receives a check date or verified deadline. Never roll recurring dates into a new cycle.', opportunities }, null, 2)+'\n');
console.log(`Preserved ${cards.length} original cards and merged funding updates into ${opportunities.length} unique opportunities.`);
