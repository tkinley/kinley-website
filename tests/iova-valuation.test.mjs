import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE,CAPITAL,SHARES,CASH,clone,value,adverseSafety,optimistic,bridge,inputBridge,reversePeak,singleCoreValue,program,corePaths} from '../assets/iova-valuation-model.mjs';
import {explore,defaults} from '../assets/iova-valuation.mjs';
const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

// Independently reproduced by the supplied NumPy v2 model, then checked
// against the downloadable web edition before publication.
const v2=(a=BASE,rate=.10)=>value(a,rate,CAPITAL.v2.shares,CAPITAL.v2.cash);

// The archived 30 October case must stay reproducible with its own capital inputs.
test('30 October v2 DCF matches the supplied Python model, including every component',()=>{
  const r=v2();close(r.equity,2770.74268517773);close(r.perShare,5.8331424951110105);
  const expected={core:2365.875282829946,labelRisk:-165.6112697980962,frontline:477.25596841308334,lung:50.37007416920832,sarcoma:35.90002023000585,endometrial:17.880697591476054,nextgen:100,oneTime:0,corporate:-350.9280882578932,cash:240};
  for(const [key,n] of Object.entries(expected))close(r.parts[key],n);
});
test('alternative scenarios reproduce Python without mutating the central case',()=>{
  const before=JSON.stringify(BASE);
  close(v2(adverseSafety()).perShare,5.027207332912558);
  const down=adverseSafety();down.weights={bear:1,base:0,bull:0};
  close(v2(down).perShare,3.0430626186915517);
  close(v2(optimistic()).perShare,7.753111600320557);
  assert.equal(JSON.stringify(BASE),before);
});
test('discount-rate sensitivity matches the independent Python values',()=>{
  close(v2(BASE,.08).perShare,6.636747035748309);
  close(v2(BASE,.12).perShare,5.172719346177629);
});
test('the same 301 probability changes frontline value and core label exposure',()=>{
  const a=clone(BASE);a.pipe.frontline.pos=1;
  const r=value(a);close(r.parts.labelRisk,0);
  assert.ok(r.parts.frontline>value().parts.frontline);
  const b=clone(BASE);b.pipe.frontline.pos=0;
  close(value(b).parts.labelRisk,-value().parts.core*.20*.70);
});
test('development costs are charged even when a program never succeeds',()=>{
  const p=clone(BASE.pipe.lung);p.pos=0;
  const r=program(p);assert.ok(r.development<0);close(r.rnpv,r.development);
});
test('reverse DCF matches Python and inverts the single-core construction',()=>{
  close(reversePeak(8.48,BASE,.10,CAPITAL.v2.shares,CAPITAL.v2.cash),1497.3527140442716,1e-8);
  close(reversePeak(),1325.5389733075135,1e-8);
  for(const peak of [650,1000,2000])close(reversePeak(singleCoreValue(peak)),peak,1e-8);
  assert.equal(reversePeak(-100),null);
});
test('core scenarios hold their plateau, then erode at the chosen rates',()=>{
  const p=corePaths(BASE);
  close(p.bear[2033],650);close(p.bear[2034],650*.88);
  close(p.base[2035],1000);close(p.base[2036],900);
  close(p.bull[2036],1400);close(p.bull[2037],1288);
});
test('bridge starts at v1, ends at v2, and reconciles unrounded changes',()=>{
  const rows=bridge();assert.equal(rows.length,7);
  close(rows.at(-1).perShare,v2().perShare);
  close(rows[0].perShare+rows.reduce((s,r)=>s+r.change,0),v2().perShare);
  assert.equal(rows[0].perShare.toFixed(2),'7.13');
});
test('explorer defaults, dilution and cash use the full DCF',()=>{
  close(explore().perShare,value().perShare);
  close(explore({...defaults,shares:500}).perShare,value().equity/500);
  close(explore({...defaults,cash:300}).perShare,value().perShare+(300-CASH)/SHARES);
  close(explore({...defaults,scenario:'optimistic',pos:60}).perShare,value(optimistic()).perShare);
});
test('explorer controls remain finite across their displayed extremes',()=>{
  for(const scenario of ['central','optimistic','safety'])for(const rate of [6,16])for(const pos of [0,100])for(const margin of [-10,10]){
    const r=explore({...defaults,scenario,rate,pos,margin});
    assert.ok(Number.isFinite(r.perShare));
    assert.ok(r.peak===null||Number.isFinite(r.peak));
  }
});

// 5 November 2026: Q3 10-Q capital inputs, checked against models/iova_rnpv_model.py.
test('5 November inputs come from the Q3 10-Q and only cash and shares change',()=>{
  close(CASH,376.320-4.470);close(SHARES,462.655151+29.660828);
  const now=value(),old=v2();
  close(now.perShare,5.895792151767088,1e-12);close(now.equity,2902.5926851777303,1e-9);
  for(const key of Object.keys(old.parts).filter(k=>k!=='cash'))close(now.parts[key],old.parts[key]);
  close(now.equity,old.equity-CAPITAL.v2.cash+CASH);
  close(value(adverseSafety()).perShare,5.11820373625018,1e-12);
  close(value(optimistic()).perShare,7.748231162231411,1e-12);
  close(value(BASE,.08).perShare,6.671131919487112,1e-12);
});
test('the capital bridge starts at $5.83, ends at the current value, and reconciles',()=>{
  const rows=inputBridge();assert.equal(rows.length,4);
  close(rows[0].perShare,v2().perShare);close(rows.at(-1).perShare,value().perShare);
  close(rows[0].perShare+rows.reduce((s,r)=>s+r.change,0),value().perShare);
  close(rows[2].shares,CAPITAL.v3.basic+CAPITAL.v2.shares-CAPITAL.v2.basicJun);
  assert.ok(rows[1].change>0&&rows[2].change<0&&rows[3].change<0);
});
