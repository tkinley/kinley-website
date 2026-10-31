import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalCDF, normalQuantile, wilson, binomialPMF, betaBinomialPMF, countInterval,
  betaCDF, betaQuantile, trialBalance, endpointRates, power, familyError,
  selectedRate, kaplanMeier, missingRates, noninferiority, interimLooks, zeroEventBound,
} from '../assets/statistics-lab-models.mjs';
import {labs,defaultValues,calculateLab,renderLab,renderChart} from '../assets/statistics-labs.mjs';
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);

test('normal probabilities and quantiles match reference values',()=>{
  close(normalCDF(0),0.5);
  close(normalCDF(1.96),0.97500210485);
  close(normalCDF(-1.96),0.02499789515);
  close(normalQuantile(0.975),1.95996398454,2e-6);
});
test('Wilson matches the established count example and stays within bounds at extremes',()=>{
  const ci=wilson(13,22);
  close(ci[0],0.387348184763,2e-7);close(ci[1],0.767441838035,2e-7);
  assert.equal(wilson(0,20)[0],0);
  close(wilson(20,20)[1],1);
  assert.ok(wilson(120,200)[1]-wilson(120,200)[0]<wilson(12,20)[1]-wilson(12,20)[0]);
});
test('binomial probabilities include degenerate cases and reproduce the teaching tail',()=>{
  const pmf=binomialPMF(10,0.3);
  close(pmf.reduce((a,b)=>a+b,0),1,1e-12);
  close(pmf.slice(4).reduce((a,b)=>a+b,0),0.3503892816,1e-12);
  assert.equal(binomialPMF(10,0)[0],1);assert.equal(binomialPMF(10,1)[10],1);
  assert.deepEqual(countInterval(binomialPMF(50,13/22)),[23,36]);
});
test('beta-binomial integrates parameter uncertainty and matches the executed notebook',()=>{
  const pmf=betaBinomialPMF(50,14,10);
  close(pmf.reduce((a,b)=>a+b,0),1,1e-12);
  close(pmf.reduce((a,p,k)=>a+k*p,0),50*14/24,1e-10);
  assert.deepEqual(countInterval(pmf),[17,40]);
});
test('beta CDF matches the integer-parameter binomial identity, and quantiles invert it',()=>{
  for(const p of [0.05,0.3,0.5,0.8,0.98]){
    const expected=binomialPMF(21,p).slice(13).reduce((a,b)=>a+b,0);
    close(betaCDF(p,13,9),expected,2e-12);
    close(betaCDF(p,1,1),p,2e-12);
  }
  for(const q of [0.025,0.5,0.975])close(betaCDF(betaQuantile(q,13,9),13,9),q,2e-12);
});
test('assignment retains the same baseline population and is reproducible',()=>{
  const r=trialBalance(50,'random',7);
  close((r[0]+r[1])/2,0.4);
  assert.deepEqual(r,trialBalance(50,'random',7));
  assert.deepEqual(trialBalance(50,'biased',7),[0,0.8]);
});
test('endpoint timelines count different outcomes without losing deaths from PFS',()=>{
  assert.deepEqual(endpointRates(6),[5/12,11/12,1]);
  const later=endpointRates(24);
  assert.deepEqual(later,[7/12,4/12,7/12]);
  assert.ok(later[1]<=later[2]);
});
test('approximate power increases with information and effect size',()=>{
  close(power(93,0.2),0.8,0.002);
  assert.ok(power(200,0.2)>power(50,0.2));
  assert.ok(power(100,0.2)>power(100,0.1));
  close(power(100,0),0.05,1e-6);
});
test('family error differs from per-test alpha and Bonferroni controls it',()=>{
  const [raw,adjusted]=familyError(20,0.05);
  close(raw,0.641514077591,1e-12);
  assert.ok(adjusted<=0.05);
  close(familyError(1,0.05)[0],0.05);
});
test('selection simulation is reproducible and selecting among one group adds no optimism',()=>{
  const single=selectedRate(1,22),searched=selectedRate(8,22);
  close(single[0],single[1]);
  assert.ok(searched[1]>searched[0]+0.1);
  assert.deepEqual(searched,selectedRate(8,22));
});
test('Kaplan-Meier evaluates events before tied censoring and handles censored-only data',()=>{
  const example=kaplanMeier([{time:2,event:true},{time:3,event:false},{time:4,event:true},{time:8,event:false},{time:9,event:false}]);
  close(example.curve.findLast(p=>p.x<=4).y,0.8*2/3);
  const tied=kaplanMeier([{time:2,event:true},{time:2,event:false},{time:3,event:false}]);
  close(tied.survival,2/3);
  assert.equal(tied.riskSets[0].atRisk,3);
  assert.equal(kaplanMeier([{time:2,event:false}]).median,null);
});
test('missing-outcome scenarios retain observed information and expose assumptions',()=>{
  assert.deepEqual(missingRates(20,0),[0.5,0.4]);
  assert.deepEqual(missingRates(20,1),[0.5,0.6]);
  assert.deepEqual(missingRates(0,0),[0.5,0.5]);
});
test('NI judgments use the lower confidence limit and a strict margin',()=>{
  assert.deepEqual(noninferiority(-2,5,10),{lo:-7,hi:3,noninferior:true,superior:false});
  assert.equal(noninferiority(-5,5,10).noninferior,false);
  assert.equal(noninferiority(4,2,10).superior,true);
});
test('more interim looks require a stricter Bonferroni threshold',()=>{
  close(interimLooks(1,2).critical,normalQuantile(0.975));
  assert.ok(interimLooks(3,2.1).critical>interimLooks(1,2.1).critical);
  assert.equal(interimLooks(3,2.1).crossed,false);
});
test('zero-event bound follows the exact binomial probability identity',()=>{
  const bound=zeroEventBound(100);
  close(bound,0.029513049607,1e-12);
  close((1-bound)**100,0.05,1e-12);
});
test('all seventeen lessons have static graphics and finite results at control limits',()=>{
  assert.equal(Object.keys(labs).length,17);
  for(const [slug,config] of Object.entries(labs)){
    const initial=defaultValues(slug);
    assert.ok(renderLab(slug).includes('role="img"'),slug);
    for(const c of config.controls){
      const candidates=c.type==='select'?c.options.map(o=>o[0]):[c.min,c.max];
      for(const value of candidates){
        const state=calculateLab(slug,{...initial,[c.key]:value});
        const graphic=renderChart(state.chart,285,state.summary);
        assert.ok(!/NaN|Infinity|undefined/.test(graphic),`${slug}, ${c.key}=${value}`);
        assert.ok(state.summary.length>40);
      }
    }
  }
});
