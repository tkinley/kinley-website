import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeProfile, evaluateOpportunity, selectResults, suggestProfile } from '../assets/student-match-engine.mjs';
const { opportunities } = JSON.parse(await readFile(new URL('../data/student-opportunities.json', import.meta.url)));
const find = title => opportunities.find(o=>o.title===title);
const profiles = {
  domesticUndergrad: { academic_level:'Undergraduate', student_status:'domestic', enrolled:'yes', field:'Biology', interests:['Food','Scholarships','Learning'] },
  internationalUndergrad: { academic_level:'Undergraduate', student_status:'international', enrolled:'yes', interests:['Food','Free Software'] },
  domesticGrad: { academic_level:'PhD', student_status:'domestic', enrolled:'yes', field:'Bioinformatics', skills:'Python genomics', interests:['Research','Travel'] },
  internationalGrad: { academic_level:"Master's", student_status:'international', enrolled:'yes', interests:['Research','Travel','Financial Support'] },
};
test('all 108 source cards retain titles, descriptions, notes, and original resource links', async()=> {
  const html = await readFile(new URL('../student-benefits.html',import.meta.url),'utf8');
  const cards = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length,108); assert.equal(opportunities.length,108); assert.equal(new Set(opportunities.map(o=>o.id)).size,108);
  for (const [i,card] of cards.entries()) {
    const o=opportunities[i];
    assert.equal(o.official_url,card[1].match(/href="([^"]*)"/)[1].replace(/&amp;/g,'&'));
    assert.ok(o.title && o.description && o.notes);
    for (const key of ['id','title','description','category','benefit_type','official_url','eligibility_rules','academic_levels','student_status_restrictions','deadline','last_verified','tags','notes']) assert.ok(key in o,key);
    assert.equal(o.last_verified,null); assert.equal(o.deadline.date,null); assert.equal(o.deadline.verified,false);
    assert.equal(o.eligibility_rules.complete,false);
  }
});
test('missing and prefer-not answers are not treated as satisfied requirements',()=> {
  for (const input of [{},{enrolled:'prefer-not'},{academic_level:'Other'}]) {
    const r=evaluateOpportunity(find('Microsoft 365'),input,'2026-10-18');
    assert.equal(r.status,'verify'); assert.ok(r.missing.some(x=>x.includes('enrollment')));
  }
  assert.equal(normalizeProfile().student_status,'');
});
test('explicit level and enrollment contradictions block recommendation before relevance',()=> {
  for (const p of [profiles.domesticUndergrad,profiles.internationalUndergrad]) {
    const r=evaluateOpportunity(find('USDA NIFA AFRI Predoctoral'),{...p,interests:['Research','Scholarships']},'2026-10-18');
    assert.equal(r.status,'ineligible'); assert.equal(r.recommended,false); assert.ok(r.conflicts.length);
  }
  const r=evaluateOpportunity(find('Microsoft 365'),{enrolled:'no',interests:['Free Software']},'2026-10-18');
  assert.equal(r.status,'ineligible'); assert.equal(r.recommended,false);
});
test('domestic and international do not establish citizenship or residency',()=> {
  for (const p of Object.values(profiles)) {
    const r=evaluateOpportunity(find('NSF GRFP'),p,'2026-10-18');
    assert.equal(r.status,'verify'); assert.ok(r.missing.some(x=>/citizen/i.test(x))); assert.equal(r.conflicts.length,0);
  }
  const sigma=evaluateOpportunity(find('Sigma Xi GIAR'),profiles.internationalGrad,'2026-10-18');
  assert.notEqual(sigma.status,'ineligible'); assert.match(sigma.opportunity.notes,/international students are eligible/);
});
test('fictional graduate profiles receive relevant research/travel with unknown requirements preserved',()=> {
  for(const p of [profiles.domesticGrad,profiles.internationalGrad]) {
    const r=evaluateOpportunity(find('GSC travel funding'),p,'2026-10-18');
    assert.equal(r.status,'verify'); assert.equal(r.recommended,true); assert.ok(r.reasons.some(x=>x.includes('Travel')));
    assert.ok(r.missing.length);
  }
});
test('past listed cycles and elapsed reported deadlines never enter recommendations',()=> {
  for (const title of ['Fulbright US Student Program','MSA Graduate Student Awards']) {
    const r=evaluateOpportunity(find(title),profiles.domesticGrad,'2026-10-18');
    assert.equal(r.expired,true); assert.equal(r.recommended,false);
  }
  const future=evaluateOpportunity(find('NSF GRFP'),profiles.domesticGrad,'2026-10-18');
  const passed=evaluateOpportunity(find('NSF GRFP'),profiles.domesticGrad,'2026-10-20');
  assert.equal(future.expired,false); assert.equal(passed.expired,true); assert.equal(passed.recommended,false);
});
test('likely eligible is possible only when documented requirements are complete and met',()=> {
  const documented={...find('Microsoft 365'),eligibility_rules:{known:find('Microsoft 365').eligibility_rules.known,unknown:[],complete:true}};
  assert.equal(evaluateOpportunity(documented,{enrolled:'yes'}).status,'likely');
  assert.equal(evaluateOpportunity(documented,{}).status,'verify');
  for(const o of opportunities) assert.notEqual(evaluateOpportunity(o,profiles.domesticGrad).status,'likely');
});
test('all view includes restricted and past entries; filters and sorting remain deterministic',()=> {
  const evaluated=opportunities.map(o=>evaluateOpportunity(o,profiles.domesticUndergrad,'2026-10-18'));
  assert.equal(selectResults(evaluated).length,108);
  assert.ok(selectResults(evaluated,{scope:'recommended'}).every(r=>r.recommended));
  for(const category of ['scholarships','research','ai-software','travel','campus-benefits','financial-support']) {
    const list=selectResults(evaluated,{category}); assert.ok(list.length); assert.ok(list.every(r=>r.opportunity.categories.includes(category)));
  }
  assert.equal(selectResults(evaluated,{query:'cupboard'})[0].opportunity.title,"Cats' Cupboard");
  const titles=selectResults(evaluated,{sort:'title'}).map(r=>r.opportunity.title);
  assert.deepEqual(titles,[...titles].sort((a,b)=>a.localeCompare(b)));
  const noVerified=selectResults(evaluated,{sort:'deadline'}).map(r=>r.opportunity.title);
  assert.deepEqual(noVerified,titles); // Never sort by a made-up annual deadline.
});
test('CV suggestions use an allowlist and never return raw identifiers, status, or enrollment',()=> {
  const raw='Fictional Person. PhD candidate in Biology at Kansas State University. International student. SSN 123-45-6789. fake@example.test. Passport ABC123. Research in Python and Genomics. Conference poster.';
  const s=suggestProfile(raw);
  assert.equal(s.academic_level,'PhD'); assert.equal(s.field,'Biology'); assert.ok(s.skills.includes('Python'));
  assert.deepEqual(Object.keys(s).sort(),['academic_level','field','interests','skills']);
  assert.doesNotMatch(JSON.stringify(s),/123|fake|international|Kansas State|ABC/);
  assert.equal(suggestProfile('PhD candidate, mentoring an undergraduate student.').academic_level,'');
  assert.deepEqual(suggestProfile('<img src=x onerror=alert(1)>'),{academic_level:'',field:'',skills:'',interests:[]});
});
test('quick topic filtering uses the interest tag, without requiring or guessing profile answers',()=> {
  const all=opportunities.map(o=>evaluateOpportunity(o,{},'2026-10-18'));
  const food=selectResults(all,{interest:'Food'});
  assert.deepEqual(food.map(r=>r.opportunity.title).sort(),["Cats' Cupboard",'Flint Hills Breadbasket'].sort());
  assert.ok(food.every(r=>r.status==='verify'));
  assert.equal(selectResults(all,{interest:'Food',category:'ai-software'}).length,0);
  assert.equal(selectResults(all,{interest:'Food',query:'cupboard'}).length,1);
  assert.equal(selectResults(all,{interest:''}).length,108);
});
