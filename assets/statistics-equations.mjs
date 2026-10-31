// Equations for the teaching examples. Each formula uses the assumptions
// described in its lesson; these are not universal clinical decision rules.
const v=x=>`<mi>${x}</mi>`, n=x=>`<mn>${x}</mn>`, t=x=>`<mtext>${x}</mtext>`;
const sub=(x,i)=>`<msub>${v(x)}${t(i)}</msub>`;
const pow=(x,p)=>`<msup>${x}${p}</msup>`;
const frac=(a,b)=>`<mfrac><mrow>${a}</mrow><mrow>${b}</mrow></mfrac>`;
const sqrt=x=>`<msqrt>${x}</msqrt>`;
const phat=`<mover><mi>p</mi><mo>^</mo></mover>`;
const sum=i=>`<munder><mo>∑</mo><mi>${i}</mi></munder>`;
const product=i=>`<munder><mo>∏</mo><mrow>${i}</mrow></munder>`;
const choose=(a,b)=>`<mo>(</mo><mfrac linethickness="0">${a}${b}</mfrac><mo>)</mo>`;
const math=(label,body)=>`<div class="lesson-equation-scroll" role="region" aria-label="${label}" tabindex="0"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${label}">${body}</math></div>`;
const eq=(label,body)=>[label,body];
const z2=pow(v('z'),n(2));
const wilson=[
  eq('Wilson denominator d equals one plus z squared over n',`${v('d')}<mo>=</mo><mn>1</mn><mo>+</mo>${frac(z2,v('n'))}`),
  eq('Wilson center',`${v('c')}<mo>=</mo>${frac(`${phat}<mo>+</mo>${frac(z2,`<mn>2</mn><mi>n</mi>`)}`,v('d'))}`),
  eq('Wilson half width',`${v('h')}<mo>=</mo>${frac(v('z'),v('d'))}${sqrt(`${frac(`${phat}<mo>(</mo><mn>1</mn><mo>−</mo>${phat}<mo>)</mo>`,v('n'))}<mo>+</mo>${frac(z2,`<mn>4</mn>${pow(v('n'),n(2))}`)}`)}`),
  eq('Wilson interval is center plus or minus half width',`<mtext>Wilson:</mtext><mspace width="0.5em"/><mo>[</mo><mi>c</mi><mo>−</mo><mi>h</mi><mo>,</mo><mi>c</mi><mo>+</mo><mi>h</mi><mo>]</mo>`)
];
const entries={
  'trial-design':{
    equations:[eq('Random allocation balances a baseline characteristic in expectation',`<mi mathvariant="normal">E</mi><mo>[</mo><msub><mover><mi>X</mi><mo>¯</mo></mover><mi>A</mi></msub><mo>−</mo><msub><mover><mi>X</mi><mo>¯</mo></mover><mi>B</mi></msub><mo>]</mo><mo>=</mo><mn>0</mn>`) ],
    note:'For complete random assignment from the same enrolled pool, the expected baseline mean difference is zero. X is a baseline characteristic; A and B are the assigned groups. A particular random assignment can still be imbalanced. This equation concerns balance, not treatment efficacy.'
  },
  'endpoints-and-estimands':{
    equations:[eq('A mean treatment effect at a fixed time compares expected outcomes under two defined strategies',`<mi>Δ</mi><mo>=</mo><mi mathvariant="normal">E</mi><mo>[</mo><msup><mi>Y</mi><mi>A</mi></msup><mo>(</mo><mi>t</mi><mo>)</mo><mo>]</mo><mo>−</mo><mi mathvariant="normal">E</mi><mo>[</mo><msup><mi>Y</mi><mi>B</mi></msup><mo>(</mo><mi>t</mi><mo>)</mo><mo>]</mo>`)],
    note:'This is one possible estimand: the difference in mean outcome at time t in a defined population under strategies A and B. The outcome and strategies must specify how events such as rescue treatment or death are handled. Other endpoints may require a different summary measure.'
  },
  'data-and-variability':{
    equations:[eq('Standard error of the mean is standard deviation divided by the square root of n',`<mtext>SE</mtext><mo>=</mo>${frac(t('SD'),sqrt(v('n')))}`),eq('Approximate normal 95 percent interval for the mean',`<mover><mi>y</mi><mo>¯</mo></mover><mo>±</mo><mn>1.96</mn><mo>×</mo><mtext>SE</mtext>`)],
    note:'n is the number of independent patients. SD describes the spread of individual outcomes; SE describes the precision of the mean. The interval is a normal approximation, as used in the example. Small samples with an estimated SD may need a t-based method.'
  },
  'response-rates':{
    equations:[eq('Observed response rate',`${phat}<mo>=</mo>${frac(v('x'),v('n'))}`),eq('Binomial probability of exactly k responses',`<mi mathvariant="normal">Pr</mi><mo>(</mo><mi>K</mi><mo>=</mo><mi>k</mi><mo>)</mo><mo>=</mo>${choose(v('n'),v('k'))}${pow(v('p'),v('k'))}${pow('<mrow><mo>(</mo><mn>1</mn><mo>−</mo><mi>p</mi><mo>)</mo></mrow>','<mrow><mi>n</mi><mo>−</mo><mi>k</mi></mrow>')}`)],
    note:'x is the observed number of responses among n patients. The binomial model treats K as a future or repeated count under independent outcomes with the same response probability p. The observed proportion estimates p; it does not make p known.'
  },
  'confidence-intervals':{
    equations:[...wilson,eq('Naive Wald interval',`<mtext>Wald:</mtext><mspace width="0.5em"/>${phat}<mo>±</mo><mi>z</mi>${sqrt(frac(`${phat}<mo>(</mo><mn>1</mn><mo>−</mo>${phat}<mo>)</mo>`,v('n')))}`)],
    note:'Here p̂ = x/n and z ≈ 1.96 for 95% intervals. Turn on the Wald comparison above and try 20 patients with a 5% or 95% response rate. Its raw bounds can leave 0–100%; at zero or all responses it collapses to a point. Wilson keeps a nonzero span. Neither method adjusts for a subgroup chosen after seeing results. <a href="https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm">NIST derivation</a>.'
  },
  'effect-sizes':{
    equations:[eq('Risk difference',`<mtext>RD</mtext><mo>=</mo>${sub('p','A')}<mo>−</mo>${sub('p','B')}`),eq('Risk ratio',`<mtext>RR</mtext><mo>=</mo>${frac(sub('p','A'),sub('p','B'))}`),eq('Odds ratio',`<mtext>OR</mtext><mo>=</mo>${frac(frac(sub('p','A'),`<mn>1</mn><mo>−</mo>${sub('p','A')}`),frac(sub('p','B'),`<mn>1</mn><mo>−</mo>${sub('p','B')}`))}`)],
    note:'pA and pB are the two response probabilities. A difference of 0.10 is 10 percentage points. Ratios need a valid nonzero denominator. Odds ratios and risk ratios can be quite different when the outcome is common.'
  },
  'p-values':{
    equations:[eq('Two sided p value for the standard normal example',`<mi>p</mi><mo>=</mo><mn>2</mn><mo>[</mo><mn>1</mn><mo>−</mo><mi>Φ</mi><mo>(</mo><mo>|</mo><mi>z</mi><mo>|</mo><mo>)</mo><mo>]</mo>`)],
    note:'Φ is the standard normal cumulative distribution function. The example assumes a test statistic z that follows that distribution under the null hypothesis. The shaded tails are at least as extreme as the observed |z| in either direction. This is not a probability that the null hypothesis is true.'
  },
  'sample-size-and-power':{
    equations:[eq('Null standard error for the two proportion approximation',`${sub('s','0')}<mo>=</mo>${sqrt(frac('<mn>2</mn><mover><mi>p</mi><mo>¯</mo></mover><mo>(</mo><mn>1</mn><mo>−</mo><mover><mi>p</mi><mo>¯</mo></mover><mo>)</mo>',v('n')))}`),eq('Alternative standard error',`${sub('s','1')}<mo>=</mo>${sqrt(frac(`${sub('p','A')}<mo>(</mo><mn>1</mn><mo>−</mo>${sub('p','A')}<mo>)</mo><mo>+</mo>${sub('p','B')}<mo>(</mo><mn>1</mn><mo>−</mo>${sub('p','B')}<mo>)</mo>`,v('n')))}`),eq('Critical difference',`<mi>c</mi><mo>=</mo>${sub('z','1−α/2')}${sub('s','0')}`),eq('Approximate power',`<mtext>Power</mtext><mo>≈</mo><mn>1</mn><mo>−</mo><mi>Φ</mi><mo>(</mo>${frac('<mi>c</mi><mo>−</mo><mi>δ</mi>',sub('s','1'))}<mo>)</mo><mo>+</mo><mi>Φ</mi><mo>(</mo>${frac('<mo>−</mo><mi>c</mi><mo>−</mo><mi>δ</mi>',sub('s','1'))}<mo>)</mo>`)],
    note:'n is patients per arm, δ = pA − pB, and p̄ = (pA + pB)/2. Φ is the standard normal CDF. This matches the example’s two-sided, normal-approximation planning calculation. It assumes independent patients and omits dropout, clustering, and interim testing; a real protocol needs a design-specific calculation.'
  },
  'multiple-testing':{
    equations:[eq('Family wise error under independent true null tests',`<mtext>FWER</mtext><mo>=</mo><mn>1</mn><mo>−</mo>${pow('<mrow><mo>(</mo><mn>1</mn><mo>−</mo><mi>α</mi><mo>)</mo></mrow>',v('m'))}`),eq('Bonferroni per test significance level',`${sub('α','test')}<mo>=</mo>${frac(v('α'),v('m'))}`),eq('Benjamini Hochberg step up cutoff',`<mi>k</mi><mo>=</mo><mo>max</mo><mo>{</mo><mi>i</mi><mo>:</mo>${sub('p','(i)')}<mo>≤</mo>${frac(v('i'),v('m'))}<mi>q</mi><mo>}</mo>`)],
    note:'m is the number of tests. The FWER equality assumes independent true nulls; at m = 20 and α = 0.05 it is about 64.2%. Bonferroni controls FWER at most α without requiring independence. For BH, sort the p-values, take the largest qualifying rank k (zero if none), and reject all ranks up to k. q targets FDR rather than FWER; the standard BH guarantee requires independence or suitable positive dependence.'
  },
  'subgroups-and-bias':{
    equations:[eq('Selecting the largest observed subgroup rate raises its expected value',`<mi mathvariant="normal">E</mi><mo>[</mo><munder><mo>max</mo><mi>g</mi></munder>${sub('p̂','g')}<mo>]</mo><mo>≥</mo><mi mathvariant="normal">E</mi><mo>[</mo>${sub('p̂','1')}<mo>]</mo>`) ],
    note:'In this simulation, every candidate group has the same true response probability, 0.30. Selecting the largest observed rate favors groups that happened to look good. The inequality describes that selection; it does not supply a correction or show that a real subgroup has no biological effect.'
  },
  'survival-analysis':{
    equations:[eq('Kaplan Meier survival estimate',`<mover><mi>S</mi><mo>^</mo></mover><mo>(</mo><mi>t</mi><mo>)</mo><mo>=</mo>${product('<msub><mi>t</mi><mi>i</mi></msub><mo>≤</mo><mi>t</mi>')}<mo>(</mo><mn>1</mn><mo>−</mo>${frac(sub('d','i'),sub('n','i'))}<mo>)</mo>`)],
    note:'At each event time ti, di is the event count and ni is the number still at risk just before that time. A censoring time changes later risk sets without causing an event drop. Interpretation relies on an appropriate independent-censoring assumption; the curve does not tell us what happened after a patient was censored.'
  },
  'bayesian-prediction':{
    equations:[eq('Beta posterior after binomial observations',`<mi>p</mi><mo>∣</mo><mi>x</mi><mo>,</mo><mi>n</mi><mo>∼</mo><mi mathvariant="normal">Beta</mi><mo>(</mo><mi>α</mi><mo>+</mo><mi>x</mi><mo>,</mo><mi>β</mi><mo>+</mo><mi>n</mi><mo>−</mo><mi>x</mi><mo>)</mo>`),eq('Posterior predictive mean count in m future patients',`<mi mathvariant="normal">E</mi><mo>[</mo><mi>K</mi><mo>∣</mo><mi>x</mi><mo>,</mo><mi>n</mi><mo>]</mo><mo>=</mo><mi>m</mi><mo>×</mo>${frac('<mi>α</mi><mo>+</mo><mi>x</mi>','<mi>α</mi><mo>+</mo><mi>β</mi><mo>+</mo><mi>n</mi>')}`)],
    note:'The prior is Beta(α, β), and x responses are observed in n comparable independent patients. The future count K has a beta-binomial distribution under the same unknown p. Its mean is m times the posterior mean of p; its spread includes uncertainty in p. This does not remove retrospective subgroup selection.'
  },
  'missing-data':{
    equations:[eq('Full cohort response rate under a chosen missing response assumption',`<mi>p</mi><mo>(</mo><mi>q</mi><mo>)</mo><mo>=</mo>${frac(`${sub('x','obs')}<mo>+</mo><mi>q</mi><mi>m</mi>`,`${sub('n','obs')}<mo>+</mo><mi>m</mi>`)}`)],
    note:'xobs responses are documented among nobs assessed patients, m outcomes are missing, and q is the assumed response rate among those missing. Moving q is a sensitivity exercise. It does not identify what the missing patients’ outcomes actually were.'
  },
  noninferiority:{
    equations:[eq('Illustrative interval around the response difference',`<mo>[</mo><mi>L</mi><mo>,</mo><mi>U</mi><mo>]</mo><mo>=</mo><mo>[</mo><mover><mi>δ</mi><mo>^</mo></mover><mo>−</mo><mi>h</mi><mo>,</mo><mover><mi>δ</mi><mo>^</mo></mover><mo>+</mo><mi>h</mi><mo>]</mo>`),eq('Noninferiority and superiority criteria when higher response is better',`<mtext>NI:</mtext><mspace width="0.4em"/><mi>L</mi><mo>&gt;</mo><mo>−</mo><mi>Δ</mi><mspace width="1em"/><mtext>Superiority:</mtext><mspace width="0.4em"/><mi>L</mi><mo>&gt;</mo><mn>0</mn>`)],
    note:'δ̂ is Drug A minus control, h is the illustrative half-width, and Δ is the allowed loss. Higher response is better here. The chart uses an assumed interval, not one estimated from a dataset. The NI margin and matching confidence level need clinical and statistical justification.'
  },
  'interim-and-adaptive':{
    equations:[eq('Illustrative Bonferroni alpha for K planned looks',`${sub('α','look')}<mo>=</mo>${frac(v('α'),v('K'))}`),eq('Illustrative two sided critical value',`${sub('z','critical')}<mo>=</mo><msup><mi>Φ</mi><mrow><mo>−</mo><mn>1</mn></mrow></msup><mo>(</mo><mn>1</mn><mo>−</mo>${frac(v('α'),'<mn>2</mn><mi>K</mi>')}<mo>)</mo>`)],
    note:'K is the number of planned analyses and Φ⁻¹ is the standard normal quantile. The exercise applies this simple two-sided Bonferroni boundary with α = 0.05. It illustrates the cost of repeated testing; it is not a calibrated group-sequential or adaptive trial design.'
  },
  'safety-and-benefit-risk':{
    equations:[eq('One sided upper risk bound after zero observed events',`${sub('p','upper')}<mo>=</mo><mn>1</mn><mo>−</mo>${pow(v('α'),frac(n(1),v('n')))}<mo>≈</mo>${frac('<mo>−</mo><mi mathvariant="normal">ln</mi><mi>α</mi>',v('n'))}`),eq('Rule of three for alpha 0.05',`${sub('p','upper')}<mo>≈</mo>${frac(n(3),v('n'))}<mspace width="0.5em"/><mtext>when α = 0.05</mtext>`)],
    note:'This is a one-sided 95% upper confidence bound for one defined event after zero events in n comparable, independent patients with complete follow-up. It does not establish zero risk, cover every possible harm, or describe risks beyond the observed follow-up period.'
  },
  iovance:{
    equations:[eq('Observed response rate for the selected Iovance subgroup',`${phat}<mo>=</mo>${frac(n(13),n(22))}<mo>≈</mo><mn>0.591</mn>`),eq('Conditional posterior under the uniform beta prior',`<mi>p</mi><mo>∣</mo><mtext>data</mtext><mo>∼</mo><mi mathvariant="normal">Beta</mi><mo>(</mo><mn>14</mn><mo>,</mo><mn>10</mn><mo>)</mo>`),eq('Conditional expected responders in m future patients',`<mi mathvariant="normal">E</mi><mo>[</mo><mi>K</mi><mo>∣</mo><mtext>data</mtext><mo>]</mo><mo>=</mo><mi>m</mi><mo>×</mo>${frac(n(14),n(24))}`)],
    note:'The posterior follows from the reported 13/22 and a Beta(1,1) prior under a binomial likelihood. With the observed rate chosen, the fixed-p mean is m × 13/22; other fixed-p choices use m × p. The beta-binomial prediction includes uncertainty in p. Neither construction corrects retrospective subgroup selection or establishes a probability of approval.'
  }
};

export function renderLessonEquations(slug){
  const entry=entries[slug];
  if(!entry)return '';
  return `<figure class="lesson-equations"><figcaption>Equations behind this example</figcaption>${entry.equations.map(([label,body])=>math(label,body)).join('')}<p>${entry.note}</p></figure>`;
}
