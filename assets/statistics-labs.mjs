import {
  clamp, normalCDF, normalQuantile, wilson, binomialPMF, betaBinomialPMF,
  countInterval, betaDensity, betaQuantile, trialBalance, endpointRates, power,
  familyError, selectedRate, kaplanMeier, missingRates, noninferiority, interimLooks,
  zeroEventBound,
} from './statistics-lab-models.mjs?v=1';

const pct = (p, digits=1) => {
  const unit=10**(-digits);
  if(p>0&&p<unit/100)return `< ${unit.toFixed(digits)}%`;
  if(p<1&&p>1-unit/100)return `> ${(100-unit).toFixed(digits)}%`;
  return `${(p*100).toFixed(digits)}%`;
};
const fixed = (v, digits=1) => v.toFixed(digits);
const prob = p => p < 0.0001 ? '< 0.0001' : p.toFixed(4);
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const range = (key, label, value, min, max, step=1, format='number', maxFrom) => ({key,label,value,min,max,step,format,maxFrom,type:'range'});
const select = (key, label, value, options) => ({key,label,value,options,type:'select'});
const bars = (labels, values) => ({type:'bars',rows:labels.map((name,i)=>({name,value:values[i],color:i===0?'teal':'blue'}))});
const line = (name, data, color='teal', extra={}) => ({name,data,color,...extra});
const points = (n, fn) => Array.from({length:n},(_,i)=>fn(i));

export const labs = {
  'trial-design': {
    title:'Explore how assignment changes baseline balance',
    question:'Compare random allocation with a deliberately biased rule that gives lower-risk patients to Drug A.',
    controls:[range('n','Patients per arm',50,10,200,10),select('method','Assignment rule','random',[['random','Random allocation'],['biased','Lower-risk patients assigned to A']]),range('seed','Random draw',7,1,20)],
    lesson:'The constructed population is 40% high-risk. Randomization balances in expectation; a particular draw can still be imbalanced. These bars show baseline risk, not treatment benefit.',
    compute:v=>{
      const rates=trialBalance(v.n,v.method,v.seed);
      return {chart:bars(['Drug A: high-risk at baseline','Control: high-risk at baseline'],rates),summary:`High-risk patients: ${pct(rates[0])} on A versus ${pct(rates[1])} on control. Baseline difference: ${fixed((rates[0]-rates[1])*100)} percentage points. ${v.method==='random'?'Change the draw to see random imbalance.':'The imbalance was introduced by the assignment rule.'}`};
    },
  },
  'endpoints-and-estimands': {
    title:'See three endpoints in the same patients',
    question:'Move the cutoff date. Responses can accumulate while progression-free and overall survival decline.',
    controls:[range('month','Data cutoff',6,3,24,1,'months')],
    lesson:'Twelve hypothetical patients are fully observed through each cutoff, with no censoring. ORR counts anyone who has responded by then, even if they later progress. These are distinct measurements; changing how rescue treatment is handled would require a separate estimand.',
    compute:v=>{ const r=endpointRates(v.month); return {chart:bars(['Response documented by cutoff (ORR)','No progression or death at cutoff','Alive at cutoff'],r),summary:`At month ${v.month}: ${Math.round(r[0]*12)}/12 have responded, ${Math.round(r[1]*12)}/12 remain progression-free, and ${Math.round(r[2]*12)}/12 are alive. The endpoint changes which outcome is counted.`}; },
  },
  'data-and-variability': {
    title:'Separate patient variability from estimate precision',
    question:'Increase the sample size while holding individual variability fixed, then change the variability itself.',
    controls:[range('n','Independent patients',25,10,400,5),range('sd','Individual standard deviation',10,5,30,1,'units')],
    lesson:'The mean is fixed at 50 units. The first span is mean ± one SD, not a 95% interval for individuals. The second is a normal-approximation 95% interval for the mean, using the chosen SD and independent-observation assumption.',
    compute:v=>{const se=v.sd/Math.sqrt(v.n);return {chart:{type:'intervals',min:0,max:100,axis:'Outcome (units)',rows:[{name:'Individual spread: mean ± SD',lo:50-v.sd,hi:50+v.sd,value:50,color:'blue'},{name:'Mean: approximate 95% interval',lo:50-1.96*se,hi:50+1.96*se,value:50,color:'teal'}]},summary:`Individual SD: ${v.sd} units. Standard error of the mean: ${fixed(se,2)} units. Approximate 95% interval: ${fixed(50-1.96*se)}–${fixed(50+1.96*se)} units. More patients narrow the interval without reducing individual SD.`};},
  },
  'response-rates': {
    title:'Explore future responder counts',
    question:'Choose an assumed probability and patient count, then shade the chance of reaching a response threshold.',
    controls:[range('n','Future patients',10,5,60),range('p','Assumed response probability',30,5,95,5,'percent'),range('k','At least this many responders',4,0,60,1,'number','n')],
    lesson:'This is a fixed-p binomial model: independent patients, a common probability, and comparable response assessment. It shows future sampling variation, while treating p as known.',
    compute:v=>{const pmf=binomialPMF(v.n,v.p/100),tail=pmf.slice(v.k).reduce((a,b)=>a+b,0);return {chart:{type:'line',min:0,max:v.n,integerX:true,ymin:0,ymax:Math.max(...pmf)*1.15,xlabel:'Future responders',ylabel:'Probability of this exact count',yformat:'probability',series:[line('Count probability',pmf.map((y,x)=>({x,y})), 'teal',{kind:'stems',tail:v.k})]},summary:`Expected count: ${fixed(v.n*v.p/100)}. Chance of at least ${v.k} responses among ${v.n} patients: ${pct(tail)}. The expected count is an average, not a guaranteed outcome.`};},
  },
  'confidence-intervals': {
    title:'Watch a Wilson interval change',
    question:'Keep the observed rate similar while increasing the sample size. Then explore rates near zero or one.',
    controls:[range('n','Observed patients',100,20,400,10),range('rate','Observed response rate',60,0,100,5,'percent')],
    lesson:'Counts are rounded from the selected percentage. Both spans are 95% Wilson intervals under a binomial model. They describe sampling uncertainty and do not adjust for retrospective subgroup selection.',
    compute:v=>{const x=Math.round(v.n*v.rate/100),baseX=Math.round(20*v.rate/100),ci=wilson(x,v.n),base=wilson(baseX,20);return {chart:{type:'intervals',min:0,max:100,axis:'Response probability (%)',rows:[{name:`20-patient comparison (${baseX}/20)`,lo:base[0]*100,hi:base[1]*100,value:baseX/20*100,color:'blue'},{name:`Selected sample (${x}/${v.n})`,lo:ci[0]*100,hi:ci[1]*100,value:x/v.n*100,color:'teal'}]},summary:`${x}/${v.n} responses = ${pct(x/v.n)}. Wilson 95% interval: ${pct(ci[0])}–${pct(ci[1])}; width ${fixed((ci[1]-ci[0])*100)} percentage points. This is an interval for a parameter, not future responder counts.`};},
  },
  'effect-sizes': {
    title:'Compare absolute benefit, relative benefit, and odds',
    question:'Change the two response rates and see how the same comparison produces different effect measures.',
    controls:[range('treatment','Drug A response rate',40,5,90,5,'percent'),range('control','Control response rate',25,5,90,5,'percent')],
    lesson:'Both arms use the same hypothetical endpoint, follow-up, and population. These are point estimates; the exercise does not calculate uncertainty or establish causality.',
    compute:v=>{const a=v.treatment/100,b=v.control/100,d=a-b,odds=(a/(1-a))/(b/(1-b));return {chart:bars(['Responders on Drug A','Responders on control'],[a,b]),summary:`Absolute difference: ${fixed(d*100)} percentage points. Risk ratio: ${fixed(a/b,2)}. Odds ratio: ${fixed(odds,2)}. ${Math.abs(d)<1e-10?'There is no response-rate difference.':`The reciprocal absolute difference is ${fixed(1/Math.abs(d))} patients per ${d>0?'additional':'lost'} response in this illustration.`}`};},
  },
  'p-values': {
    title:'Shade the two-sided p-value',
    question:'Move an observed z statistic away from zero and watch the null-model tail area shrink.',
    controls:[range('z','Observed absolute z statistic',2,0,4,0.1,'decimal'),select('alpha','Prespecified significance level','0.05',[['0.01','1%'],['0.05','5%'],['0.10','10%']])],
    lesson:'The curve is a standard normal null distribution. The shaded area is P(|Z| ≥ observed |z|) under that model. It is not the probability that the null hypothesis is true or that a drug works. The plotted curve stops at ±4; reported probabilities include the full tails.',
    compute:v=>{const p=2*(1-normalCDF(v.z));return {chart:{type:'line',min:-4,max:4,ymin:0,ymax:0.44,xlabel:'z under the null model',ylabel:'Probability density',shade:v.z,series:[line('Standard normal null',points(161,i=>{const x=-4+i/20;return{x,y:Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)};}))]},summary:`Two-sided p ${p<0.0001?'< 0.0001':`= ${prob(p)}`}. At α = ${pct(Number(v.alpha),0)}, this ${p<=Number(v.alpha)?'crosses':'does not cross'} the chosen threshold. The effect size and trial design still need interpretation.`};},
  },
  'sample-size-and-power': {
    title:'See sample size and assumed effect change power',
    question:'Reduce the assumed response difference, then increase the number of patients per arm.',
    controls:[range('n','Patients per arm',95,20,400,5),range('effect','Assumed response difference',20,5,30,1,'pp')],
    lesson:'Normal approximation for independent equal-sized arms, control response 30%, two-sided α = 0.05, complete outcomes, and no multiplicity or interim adjustment. This is a teaching approximation, not a clinical-trial design calculator.',
    compute:v=>{const p=power(v.n,v.effect/100);return {chart:{type:'line',min:20,max:400,ymin:0,ymax:1,xlabel:'Patients per arm',ylabel:'Power under the assumed effect',yformat:'probability',series:[line(`Difference ${v.effect} percentage points`,points(77,i=>({x:20+i*5,y:power(20+i*5,v.effect/100)})))],markers:[{x:v.n,y:p}],references:[{y:0.8,name:'80% power'}]},summary:`Assume ${30+v.effect}% response on A versus 30% on control. At ${v.n} patients per arm, approximate power is ${pct(p)}. This is the chance of rejecting the null if that assumed effect is true, not the probability of trial success.`};},
  },
  'multiple-testing': {
    title:'Watch false-positive opportunities accumulate',
    question:'Increase the number of independent tests when every null hypothesis is true.',
    controls:[range('m','Independent null tests',20,1,100),select('alpha','Family error target','0.05',[['0.01','1%'],['0.05','5%'],['0.10','10%']])],
    lesson:'These exact family-wise probabilities assume independent tests and all nulls true. Bonferroni uses α/m per test and controls family-wise error more generally too. This chart concerns FWER, not false discovery rate.',
    compute:v=>{const r=familyError(v.m,Number(v.alpha));return {chart:bars(['Any false positive: nominal α for each test','Any false positive: Bonferroni α/m'],r),summary:`With ${v.m} tests: unadjusted chance of at least one false positive ${pct(r[0])}; Bonferroni chance ${pct(r[1])}. The adjusted per-test threshold is ${fixed(Number(v.alpha)/v.m,5)}.`};},
  },
  'subgroups-and-bias': {
    title:'Select the best-looking subgroup',
    question:'All hypothetical groups have true response probability 30%. Compare a group chosen in advance with the group selected for the highest observed rate.',
    controls:[range('groups','Candidate groups searched',8,1,20),range('n','Patients in each group',22,10,100,2)],
    lesson:'The bars average 600 seeded simulations of independent groups. This invented search illustrates selection optimism; it does not estimate bias in any real company’s analysis. Both groups have the same true underlying p = 30%.',
    compute:v=>{const r=selectedRate(v.groups,v.n);return {chart:bars(['Mean rate: group fixed in advance','Mean rate: best observed group'],r),summary:`Across 600 simulated searches: prespecified group ${pct(r[0])}; selected best group ${pct(r[1])}. Average selection gap: ${fixed((r[1]-r[0])*100)} percentage points. A higher selected rate need not reflect a different true probability.`};},
  },
  'survival-analysis': {
    title:'Explore censoring in a Kaplan–Meier curve',
    question:'Move one patient’s last known follow-up. Other event and censoring times stay fixed.',
    controls:[range('censor','One patient’s censoring time',6,2,16,1,'months')],
    lesson:'Eight hypothetical patients: four events and four right-censored observations. A + marks censoring without a downward step. Events at a tied time are evaluated before removing censored patients. Interpretation requires appropriate censoring assumptions.',
    compute:v=>{const records=[{time:3,event:true},{time:5,event:true},{time:9,event:true},{time:12,event:true},{time:8,event:false},{time:14,event:false},{time:16,event:false},{time:v.censor,event:false}],km=kaplanMeier(records);const at12=km.curve.filter(p=>p.x<=12).at(-1).y;return {chart:{type:'line',min:0,max:18,ymin:0,ymax:1,xlabel:'Months from entry',ylabel:'Estimated event-free survival',yformat:'probability',series:[line('Kaplan–Meier estimate',km.curve),line('Censored (+)',km.censorMarks,'blue',{kind:'cross'})]},summary:`Estimated survival at month 12: ${pct(at12)}. Median: ${km.median===null?'not reached':`${km.median} months`}. The movable patient is known to be event-free only through month ${v.censor}; changing that time changes later risk sets.`};},
  },
  'bayesian-prediction': {
    title:'Update a prior with observed responses',
    question:'Change the observed counts and prior, then compare the prior distribution with the posterior.',
    controls:[range('n','Observed patients',20,10,80),range('x','Observed responses',12,0,80,1,'number','n'),select('prior','Prior for the response probability','uniform',[['uniform','Beta(1,1): uniform'],['skeptical','Beta(3,7): illustrative 30% mean'],['centered','Beta(10,10): illustrative 50% mean']])],
    lesson:'An independent binomial likelihood updates the selected beta prior. The priors are illustrative, not calibrated to a therapy. Credible intervals are conditional on this prior and likelihood; selection bias and population shifts are not automatically included.',
    compute:v=>{const [a,b]=v.prior==='skeptical'?[3,7]:v.prior==='centered'?[10,10]:[1,1],pa=a+v.x,pb=b+v.n-v.x,ci=[betaQuantile(0.025,pa,pb),betaQuantile(0.975,pa,pb)];const data=(aa,bb)=>points(161,i=>{const p=0.001+i*0.998/160;return{x:p*100,y:betaDensity(p,aa,bb)};});const prior=data(a,b),posterior=data(pa,pb);return {chart:{type:'line',min:0,max:100,ymin:0,ymax:Math.max(...prior.map(p=>p.y),...posterior.map(p=>p.y))*1.12,xlabel:'Response probability (%)',ylabel:'Probability density',series:[line(`Prior Beta(${a},${b})`,prior,'blue',{dash:true}),line(`Posterior Beta(${pa},${pb})`,posterior)]},summary:`Observed rate: ${pct(v.x/v.n)}. Posterior mean: ${pct(pa/(pa+pb))}. Equal-tailed 95% credible interval: ${pct(ci[0])}–${pct(ci[1])}. Compare this parameter distribution with a future-outcome prediction in the explanation below.`};},
  },
  'missing-data': {
    title:'Explore assumptions about missing outcomes',
    question:'Start with a 50% response rate among observed patients. Change how many outcomes are missing and the response rate assumed for them.',
    controls:[range('missing','Missing outcomes out of 100 patients',20,0,60,10),range('assumed','Assumed response among missing patients',0,0,100,10,'percent')],
    lesson:'The full-cohort value is a sensitivity scenario, not an estimate justified by the observed data alone. All missing patients share the selected assumed response rate. No claim about MAR, MNAR, or a particular imputation method is established here.',
    compute:v=>{const r=missingRates(v.missing,v.assumed/100);return {chart:bars(['Observed assessments only','All 100: with assumed missing outcomes'],r),summary:`${100-v.missing} observed assessments and ${v.missing} missing outcomes. Observed-case rate: ${pct(r[0])}. Under an assumed ${v.assumed}% response rate for missing patients, full-cohort response is ${pct(r[1])}. The assumption can change the apparent result.`};},
  },
  noninferiority: {
    title:'Move an interval across a noninferiority margin',
    question:'Choose a risk difference, interval width, and illustrative margin. Higher response is better.',
    controls:[range('effect','Estimated response difference',-2,-15,10,1,'pp'),range('half','Confidence-interval half-width',5,2,15,1,'pp'),range('margin','Allowed loss (margin magnitude)',10,5,15,1,'pp')],
    lesson:'The interval is assumed for illustration, not calculated from patient data. Noninferiority requires its lower bound to exceed the negative margin; superiority requires it to exceed zero under the matching test. The margin still needs clinical and statistical justification.',
    compute:v=>{const r=noninferiority(v.effect,v.half,v.margin);return {chart:{type:'intervals',min:-30,max:30,axis:'Drug A minus control (percentage points)',references:[{x:-v.margin,color:'amber'},{x:0,color:'muted'}],rows:[{name:'Assumed 95% confidence interval',lo:r.lo,hi:r.hi,value:v.effect,color:'teal'}]},summary:`Difference ${v.effect} pp; interval ${r.lo} to ${r.hi} pp. Margin: −${v.margin} pp (amber dashed line); zero: gray dashed line. ${r.noninferior?'The interval clears the NI margin.':'Noninferiority is not established by this interval.'} ${r.superior?'The interval also clears zero.':'Superiority is not established by this interval.'}`};},
  },
  'interim-and-adaptive': {
    title:'Compare nominal and adjusted interim thresholds',
    question:'Increase the number of planned looks and move the last observed z statistic.',
    controls:[range('looks','Planned analyses',3,1,5),range('z','Last observed absolute z statistic',2.1,0.5,3.8,0.1,'decimal')],
    lesson:'A simple conservative teaching plan divides two-sided α = 0.05 equally across looks with Bonferroni. This is not an alpha-spending or optimized group-sequential design. The z path is illustrative, not a simulated trial; the adjustment remains valid without assuming independent looks.',
    compute:v=>{const r=interimLooks(v.looks,v.z);return {chart:{type:'line',min:0.5,max:v.looks+0.5,ymin:0,ymax:4.2,xlabel:'Planned analysis number',ylabel:'Absolute z statistic',series:[line('Illustrative z path',r.points,'teal',{dots:true})],references:[{y:normalQuantile(0.975),name:'Nominal 5% threshold',color:'muted'},{y:r.critical,name:'Bonferroni planned threshold',color:'amber'}]},summary:`Last nominal two-sided p = ${prob(r.nominalP)}. With ${v.looks} planned looks, the per-look cutoff is ${prob(0.05/v.looks)} (|z| ≥ ${fixed(r.critical,2)}). ${r.crossed?'This path crosses the adjusted boundary.':'This path does not cross the adjusted boundary.'}`};},
  },
  'safety-and-benefit-risk': {
    title:'See why zero events does not mean zero risk',
    question:'Choose a hypothetical event risk and sample size. Then inspect how likely zero events would be.',
    controls:[range('n','Patients with complete follow-up',100,20,1000,20),range('risk','Assumed event risk',1,0.1,5,0.1,'percent1')],
    lesson:'The curve assumes independent binary events, a common risk, and complete comparable follow-up. The confidence bound is a separate calculation conditional on actually observing zero events. It does not certify overall safety or address later harms.',
    compute:v=>{const risk=v.risk/100,chance=(1-risk)**v.n;return {chart:{type:'line',min:0,max:1000,ymin:0,ymax:1,xlabel:'Patients observed',ylabel:'Probability of observing zero events',yformat:'probability',series:[line(`Assumed event risk ${v.risk}%`,points(101,i=>({x:i*10,y:(1-risk)**(i*10)})))],markers:[{x:v.n,y:chance}]},summary:`If true risk were ${fixed(v.risk)}%, the chance of zero events among ${v.n} patients would be ${pct(chance)}. If zero events are actually observed, the exact one-sided 95% upper bound is ${pct(zeroEventBound(v.n),2)} (rule of three: ${pct(3/v.n,2)}).`};},
  },
  iovance: {
    title:'Explore conditional predictions for new patients',
    question:'Change the hypothetical future cohort size or the fixed-p assumption. Compare the resulting responder-count intervals.',
    controls:[range('n','Hypothetical future patients',50,10,200,10),select('p','Fixed-p assumption','observed',[['observed','13/22: reported subgroup rate'],['0.4','40%: illustrative assumption'],['0.5','50%: illustrative assumption'],['0.7','70%: illustrative assumption']])],
    lesson:'The beta-binomial model keeps the reported 13/22 data and Beta(1,1) prior, giving a Beta(14,10) posterior. Changing the fixed-p choice does not change those observations. Neither prediction corrects retrospective selection or differences between cohorts.',
    compute:v=>{const p=v.p==='observed'?13/22:Number(v.p),fixedPMF=binomialPMF(v.n,p),bayesPMF=betaBinomialPMF(v.n,14,10),a=countInterval(fixedPMF),b=countInterval(bayesPMF);return {chart:{type:'intervals',min:0,max:v.n,axis:'Future responder count',rows:[{name:'Fixed-p binomial',lo:a[0],hi:a[1],value:v.n*p,color:'teal'},{name:'Beta-binomial: Beta(14,10)',lo:b[0],hi:b[1],value:v.n*14/24,color:'blue'}]},summary:`Among ${v.n} hypothetical new patients: binomial expected count ${fixed(v.n*p)}, central 95% count interval ${a[0]}–${a[1]}; beta-binomial expected count ${fixed(v.n*14/24)}, interval ${b[0]}–${b[1]}. These are conditional count predictions, not a probability of approval.`};},
  },
};

export function defaultValues(slug) {
  return Object.fromEntries(labs[slug].controls.map(c=>[c.key,c.value]));
}
function normalize(config, values) {
  const result={...values};
  for(const c of config.controls){
    if(c.type==='range') result[c.key]=clamp(Number(result[c.key]),c.min,c.maxFrom?Number(result[c.maxFrom]):c.max);
    else if(!c.options.some(o=>o[0]===String(result[c.key]))) result[c.key]=c.value;
  }
  return result;
}
export function calculateLab(slug, values=defaultValues(slug)) {
  const config=labs[slug];
  if(!config) throw new Error(`Unknown learning example: ${slug}`);
  return config.compute(normalize(config,values));
}
function formatControl(c,v) {
  if(c.type==='select') return '';
  if(c.format==='percent'||c.format==='percent1') return `${Number(v).toFixed(c.format==='percent1'?1:0)}%`;
  if(c.format==='pp')return `${v} pp`;
  if(c.format==='months')return `${v} months`;
  if(c.format==='units')return `${v} units`;
  return c.format==='decimal'?Number(v).toFixed(1):String(v);
}
const svgText = (x,y,value,anchor='start') => `<text x="${x}" y="${y}" text-anchor="${anchor}">${esc(value)}</text>`;
const fmtTick = (v,type) => type==='probability'?`${Math.round(v*100)}%`:Number(v.toFixed(2)).toString();
const numberSpan = (row,integer=false) => `${fixed(row.lo,integer?0:1)}–${fixed(row.hi,integer?0:1)}`;
export function renderChart(chart, width=720, summary='') {
  const w=Math.max(270,Math.round(width));
  if(chart.type==='bars')return `<div class="lab-bars" role="img" aria-label="${esc(summary)}">${chart.rows.map(r=>`<div class="lab-bar-row"><div class="lab-bar-label"><span>${esc(r.name)}</span><strong>${esc(pct(r.value))}</strong></div><div class="lab-bar-track" aria-hidden="true"><div class="lab-bar-fill lab-${r.color}" style="width:${clamp(r.value,0,1)*100}%"></div></div></div>`).join('')}<div class="lab-bar-scale" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></div>`;
  if(chart.type==='intervals'){
    const narrow=w<520,left=22,right=22,rowHeight=narrow?84:65,top=22,h=top+chart.rows.length*rowHeight+48;
    const x=v=>left+(v-chart.min)/(chart.max-chart.min)*(w-left-right);
    let marks='';
    for(const ref of chart.references||[]) marks+=`<line class="lab-stroke-${ref.color||'muted'} lab-dashed" x1="${x(ref.x)}" x2="${x(ref.x)}" y1="10" y2="${h-42}"/>`;
    chart.rows.forEach((row,i)=>{const y=top+i*rowHeight;
      marks+=svgText(left,y,row.name);
      marks+=svgText(narrow?left:w-right,narrow?y+18:y,numberSpan(row,chart.axis==='Future responder count'),narrow?'start':'end');
      const yy=y+(narrow?39:27);
      marks+=`<g class="lab-stroke-${row.color}"><line x1="${x(row.lo)}" x2="${x(row.hi)}" y1="${yy}" y2="${yy}" stroke-width="4"/><line x1="${x(row.lo)}" x2="${x(row.lo)}" y1="${yy-6}" y2="${yy+6}"/><line x1="${x(row.hi)}" x2="${x(row.hi)}" y1="${yy-6}" y2="${yy+6}"/></g><circle class="lab-fill-${row.color}" cx="${x(row.value)}" cy="${yy}" r="5"/>`;
    });
    const ticks=w<450?3:4;
    for(let i=0;i<=ticks;i++){const raw=chart.min+(chart.max-chart.min)*i/ticks,v=Number(raw.toFixed(chart.axis==='Future responder count'?0:1));marks+=svgText(x(v),h-19,v,i===0?'start':i===ticks?'end':'middle');}
    return `<svg class="lab-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(summary)}"><title>${esc(chart.axis)}</title>${marks}</svg><p class="lab-axis-caption">${esc(chart.axis)}</p>`;
  }
  const h=275,left=48,right=18,top=18,bottom=44,iw=w-left-right,ih=h-top-bottom;
  const x=v=>left+(v-chart.min)/(chart.max-chart.min)*iw;
  const y=v=>top+(chart.ymax-v)/(chart.ymax-chart.ymin)*ih;
  let marks='';
  for(let i=0;i<=4;i++){const value=chart.ymin+(chart.ymax-chart.ymin)*i/4,yy=y(value);marks+=`<line class="lab-gridline" x1="${left}" x2="${w-right}" y1="${yy}" y2="${yy}"/>`+svgText(left-8,yy+4,fmtTick(value,chart.yformat),'end');}
  const xTicks=chart.xlabel==='Planned analysis number'?Array.from({length:Math.round(chart.max-0.5)},(_,i)=>i+1):chart.xlabel==='Patients per arm'?[20,100,200,300,400]:chart.xlabel==='Patients observed'?[0,250,500,750,1000]:chart.shade!==undefined?[-4,-2,0,2,4]:[...new Set(points(4,i=>Number((chart.min+(chart.max-chart.min)*i/3).toFixed(chart.integerX?0:1))))];
  xTicks.forEach((value,i)=>{marks+=svgText(x(value),h-20,value,i===0?'start':i===xTicks.length-1?'end':'middle');});
  if(chart.shade!==undefined){
    for(const side of [-1,1]){const boundary=side*chart.shade,edge=side*4;const tail=points(61,i=>{const xx=boundary+(edge-boundary)*i/60;return{x:xx,y:Math.exp(-xx*xx/2)/Math.sqrt(2*Math.PI)};});marks+=`<path class="lab-tail" d="M ${x(tail[0].x)} ${y(0)} ${tail.map(p=>`L ${x(p.x)} ${y(p.y)}`).join(' ')} L ${x(tail.at(-1).x)} ${y(0)} Z"/>`;}
  }
  for(const ref of chart.references||[])marks+=`<line class="lab-stroke-${ref.color||'muted'} lab-dashed" x1="${left}" x2="${w-right}" y1="${y(ref.y)}" y2="${y(ref.y)}"/>`;
  for(const series of chart.series){
    if(series.kind==='stems'){
      const stroke=Math.max(2,Math.min(9,iw/(series.data.length+2)*0.7));
      marks+=series.data.map(p=>`<line class="lab-stroke-${p.x>=series.tail?'blue':'teal'}" x1="${x(p.x)}" x2="${x(p.x)}" y1="${y(0)}" y2="${y(p.y)}" stroke-width="${stroke}"/>`).join('');
    } else if(series.kind==='cross')marks+=series.data.map(p=>`<path class="lab-stroke-${series.color}" d="M ${x(p.x)-4} ${y(p.y)} h 8 M ${x(p.x)} ${y(p.y)-4} v 8" stroke-width="2"/>`).join('');
    else{
      marks+=`<path class="lab-stroke-${series.color}${series.dash?' lab-dashed':''}" d="${series.data.map((p,i)=>`${i?'L':'M'} ${x(p.x)} ${y(p.y)}`).join(' ')}" fill="none" stroke-width="2.5"/>`;
      if(series.dots)marks+=series.data.map(p=>`<circle class="lab-fill-${series.color}" cx="${x(p.x)}" cy="${y(p.y)}" r="4"/>`).join('');
    }
  }
  for(const p of chart.markers||[])marks+=`<circle class="lab-fill-teal lab-current-point" cx="${x(p.x)}" cy="${y(p.y)}" r="5"/>`;
  const legend=[...chart.series,...(chart.references||[]).map(r=>({...r,color:r.color||'muted',dash:true}))];
  return `<p class="lab-axis-caption">${esc(chart.ylabel)}</p><svg class="lab-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(summary)}"><title>${esc(chart.ylabel)} versus ${esc(chart.xlabel)}</title>${marks}</svg><p class="lab-axis-caption">${esc(chart.xlabel)}</p><ul class="lab-legend">${legend.map(s=>`<li><span class="lab-swatch lab-stroke-${s.color}${s.dash?' lab-dashed':''}" aria-hidden="true"></span>${esc(s.name)}</li>`).join('')}${chart.series.some(s=>s.kind==='stems')?'<li><span class="lab-swatch lab-stroke-blue" aria-hidden="true"></span>At or above threshold</li>':''}</ul>`;
}

export function renderLab(slug) {
  const config=labs[slug];
  if(!config)throw new Error(`Missing learning example: ${slug}`);
  const values=defaultValues(slug),state=calculateLab(slug,values);
  return `<section class="learning-lab" data-statistics-lab="${slug}" aria-labelledby="lab-title"><p class="kicker">Learn by changing the example</p><h2 id="lab-title">${esc(config.title)}</h2><p>${esc(config.question)}</p><div class="lab-controls">${config.controls.map(c=>`<div class="lab-control"><label for="lab-${c.key}">${esc(c.label)}${c.type==='range'?` <output for="lab-${c.key}" data-lab-value="${c.key}">${esc(formatControl(c,values[c.key]))}</output>`:''}</label>${c.type==='select'?`<select id="lab-${c.key}" data-lab-key="${c.key}" disabled>${c.options.map(([value,label])=>`<option value="${value}"${value===c.value?' selected':''}>${esc(label)}</option>`).join('')}</select>`:`<input id="lab-${c.key}" data-lab-key="${c.key}" type="range" min="${c.min}" max="${c.maxFrom?values[c.maxFrom]:c.max}" step="${c.step}" value="${values[c.key]}" disabled>`}</div>`).join('')}</div><figure class="lab-figure"><div class="lab-plot">${renderChart(state.chart,720,state.summary)}</div><figcaption class="lab-summary" aria-live="polite" aria-atomic="true">${esc(state.summary)}</figcaption></figure><p class="lab-lesson">${esc(config.lesson)}</p><button class="lab-reset" type="button" disabled>Reset example</button><noscript><p>The default graphic is shown. Enable JavaScript to change the controls.</p></noscript></section>`;
}
function mountLab(root) {
  const slug=root.dataset.statisticsLab,config=labs[slug];
  let values=defaultValues(slug);
  const plot=root.querySelector('.lab-plot'),summary=root.querySelector('.lab-summary');
  const controls=[...root.querySelectorAll('[data-lab-key]')];
  function draw(){
    values=normalize(config,values);
    for(const c of config.controls){
      const input=root.querySelector(`[data-lab-key="${c.key}"]`);
      if(c.maxFrom)input.max=values[c.maxFrom];
      input.value=values[c.key];
      const output=root.querySelector(`[data-lab-value="${c.key}"]`);
      if(output)output.textContent=formatControl(c,values[c.key]);
    }
    const state=calculateLab(slug,values);
    plot.innerHTML=renderChart(state.chart,plot.clientWidth||720,state.summary);
    if(summary.textContent!==state.summary)summary.textContent=state.summary;
  }
  for(const input of controls){input.disabled=false;input.addEventListener('input',()=>{values[input.dataset.labKey]=input.type==='range'?Number(input.value):input.value;draw();});}
  const reset=root.querySelector('.lab-reset');reset.disabled=false;reset.addEventListener('click',()=>{values=defaultValues(slug);draw();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(draw).observe(plot);
  else window.addEventListener('resize',draw);
  draw();
  root.dataset.labReady='true';
}
if(typeof document!=='undefined')document.querySelectorAll('[data-statistics-lab]').forEach(mountLab);
