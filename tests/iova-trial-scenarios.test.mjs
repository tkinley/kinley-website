import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BASE,clone,value,program} from '../assets/iova-valuation-model.mjs';
import {COUPLED_REFERENCE,INDEPENDENT_ILLUSTRATION,joint301Value,validateJointProbabilities,renderJoint301Explorer} from '../assets/iova-trial-scenarios.mjs';

const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('the coupled reference preserves every archived v2 component and input',()=>{
  const before=JSON.stringify(BASE),reference=value(),result=joint301Value(COUPLED_REFERENCE);
  close(result.perShare,5.8331424951110105);close(result.equity,reference.equity);
  for(const key of Object.keys(reference.parts))close(result.parts[key],reference.parts[key]);
  assert.equal(JSON.stringify(BASE),before);
});

test('joint probabilities are exclusive, finite, bounded, and normalized',()=>{
  for(const invalid of [null,[],{}, {...COUPLED_REFERENCE,typo:0}, {...COUPLED_REFERENCE,both:.4}, {...COUPLED_REFERENCE,both:-.5,neither:1.5}, {...COUPLED_REFERENCE,both:NaN}, {...COUPLED_REFERENCE,both:Infinity}, {...COUPLED_REFERENCE,both:'0.5'}]){
    assert.throws(()=>validateJointProbabilities(invalid));
  }
  assert.throws(()=>joint301Value(COUPLED_REFERENCE,BASE,-1));
  assert.throws(()=>joint301Value(COUPLED_REFERENCE,BASE,.1,0));
  assert.throws(()=>joint301Value(COUPLED_REFERENCE,BASE,.1,475,NaN));
  const a=clone(BASE);a.pWithdraw=2;assert.throws(()=>joint301Value(COUPLED_REFERENCE,a));
});

test('same marginals preserve expected value without asserting an identical distribution',()=>{
  const coupled=joint301Value(COUPLED_REFERENCE),independent=joint301Value(INDEPENDENT_ILLUSTRATION);
  close(independent.frontlineSuccess,.5);close(independent.confirmationFailure,.5);
  close(independent.perShare,coupled.perShare);
  assert.notDeepEqual(independent.probabilities,coupled.probabilities);
  assert.equal(Object.hasOwn(independent,'percentiles'),false);
});

test('ORR-only and confirmation-only outcomes affect different value components',()=>{
  const orr=joint301Value({both:0,orrOnly:1,confirmationOnly:0,neither:0});
  const confirm=joint301Value({both:0,orrOnly:0,confirmationOnly:1,neither:0});
  close(orr.frontlineSuccess,1);close(orr.confirmationFailure,1);
  close(confirm.frontlineSuccess,0);close(confirm.confirmationFailure,0);
  close(orr.parts.labelRisk,-orr.parts.core*BASE.pWithdraw*.70);
  close(confirm.parts.labelRisk,0);
  close(orr.parts.frontline,program({...BASE.pipe.frontline,pos:1}).rnpv);
  close(confirm.parts.frontline,program({...BASE.pipe.frontline,pos:0}).rnpv);
  for(const key of Object.keys(orr.parts).filter(key=>!['frontline','labelRisk'].includes(key)))close(orr.parts[key],confirm.parts[key]);
});

test('an ORR-only mass shift changes label exposure with the frontline marginal held fixed',()=>{
  const a=joint301Value({both:.4,orrOnly:.1,confirmationOnly:.1,neither:.4});
  const b=joint301Value({both:.2,orrOnly:.3,confirmationOnly:.1,neither:.4});
  close(a.frontlineSuccess,b.frontlineSuccess);close(a.parts.frontline,b.parts.frontline);
  close(b.confirmationFailure-a.confirmationFailure,.2);
  close(b.parts.labelRisk-a.parts.labelRisk,-.2*BASE.pWithdraw*.70*a.parts.core);
});

test('alternate shares, cash, discount rate, and assumptions retain original component math',()=>{
  const a=clone(BASE);a.marginShift=.03;a.coreMult=.95;a.pWithdraw=.15;
  const result=joint301Value(COUPLED_REFERENCE,a,.08,500,300),reference=value(a,.08,500,300);
  close(result.perShare,reference.perShare);close(result.archivedPerShare,reference.perShare);
  close(result.parts.cash,300);
});

test('published scenario JSON is reproducible and labels the limitations',()=>{
  const snapshot=JSON.parse(readFileSync(new URL('../data/iova-trial-scenarios.json',import.meta.url),'utf8'));
  assert.equal(snapshot.asOf,'2026-11-01');
  for(const scenario of Object.values(snapshot.scenarios))close(scenario.perShare,joint301Value(scenario.probabilities).perShare);
  assert.match(snapshot.riskDistributionNote,/No revised Monte Carlo/);
});

test('the explorer has a static reference and disables controls until enhanced',()=>{
  const html=renderJoint301Explorer();
  assert.match(html,/\$5\.83/);assert.match(html,/aria-live="polite"/);
  assert.equal((html.match(/data-joint-key=/g)||[]).length,4);
  assert.equal((html.match(/ disabled/g)||[]).length,6);
  assert.match(html,/not estimates from the single-arm response data/);
});

const python=process.env.IOVA_PYTHON||'C:/Users/Kinley Tenzin/anaconda3/python.exe';
test('independent Python calculations agree for all joint outcomes',{skip:!existsSync(python)},()=>{
  const file=fileURLToPath(new URL('../models/iova_trial_scenarios.py',import.meta.url));
  const report=JSON.parse(execFileSync(python,[file],{encoding:'utf8',timeout:30000}));
  for(const scenario of Object.values(report.scenarios)){
    const js=joint301Value(scenario.probabilities);
    close(scenario.perShare,js.perShare);close(scenario.equity,js.equity,1e-8);
    for(const key of Object.keys(js.parts))close(scenario.parts[key],js.parts[key],1e-8);
  }
});
