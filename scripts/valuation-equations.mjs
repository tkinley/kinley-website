// Static MathML keeps the equations readable without a browser-side dependency.
const variable=name=>`<mi>${name}</mi>`;
const text=name=>`<mtext>${name}</mtext>`;
const sub=(name,index)=>`<msub>${variable(name)}${text(index)}</msub>`;
const dy=`<msub><mi>D</mi><mi>y</mi></msub>`;
const sum=index=>`<munder><mo>∑</mo><mi>${index}</mi></munder>`;
const years=`<munderover><mo>∑</mo><mrow><mi>y</mi><mo>=</mo><mn>2027</mn></mrow><mn>2045</mn></munderover>`;
const vc=sub('V','core'),npv=sub('rNPV','j'),share=sub('V','share');
const math=(label,body)=>`<div class="equation-scroll" role="region" aria-label="${label}" tabindex="0"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${label}">${body}</math></div>`;
const lines=(...rows)=>`<mtable columnalign="left" rowspacing="0.4em">${rows.map(row=>`<mtr><mtd>${row}</mtd></mtr>`).join('')}</mtable>`;
const card=(title,formula,explanation)=>`<figure class="valuation-equation"><figcaption>${title}</figcaption>${formula}<p>${explanation}</p></figure>`;
const dollars=n=>`<mtext>$</mtext><mn>${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</mn>`;

export function renderValuationEquations({equity,shares,coreLoss,lung,peak}){
  return {
    discount:card('How I discount a future year',math('Discount factor for year y equals one divided by one plus r to the power y minus 2027 plus one half',`${dy}<mo>=</mo><mfrac><mn>1</mn><msup><mrow><mo>(</mo><mn>1</mn><mo>+</mo><mi>r</mi><mo>)</mo></mrow><mrow><mi>y</mi><mo>−</mo><mn>2027</mn><mo>+</mo><mn>0.5</mn></mrow></msup></mfrac>`),'Here, <i>r</i> is my discount rate: 0.10 in the base case. The 0.5 puts each year’s cash flow in the middle of that year. I use this factor for 2027–2045, relative to roughly the end of 2026.'),
    core:card('How I combine the three melanoma outcomes',
      math('Modeled product cash flow equals revenue times margin times the tax factor',`${sub('CF','s,y')}<mo>=</mo>${sub('R','s,y')}<mo>×</mo>${sub('m','s,y')}<mo>×</mo>${sub('a','y')}`)+
      math('Core value equals the sum across scenarios of scenario weight times discounted cash flows',`${vc}<mo>=</mo>${sum('s')}${sub('w','s')}<mo>×</mo><mrow><mo>(</mo>${years}${sub('CF','s,y')}<mo>×</mo>${dy}<mo>)</mo></mrow>`),
      '<i>s</i> is the bear, base, or bull case; <i>w</i> is its weight. <i>R</i> is revenue and <i>m</i> is margin. For the modeled product profits, the tax factor <i>a</i> is 1 through 2032 and 0.79 from 2033. I calculate each path first, then weight them 40%, 45%, and 15%. Development and corporate costs are deducted separately without a tax benefit.'),
    pipeline:card('How I put a value on an experimental program',
      math('Program risk adjusted value equals success probability times commercial present value minus development present value',`${npv}<mo>=</mo>${sub('p','j')}<mo>×</mo>${sub('P','j')}<mo>−</mo>${sub('C','j')}`)+
      math('Lung value equals 30 percent of its commercial present value minus its development present value',lines(`${sub('rNPV','lung')}<mo>≈</mo><mn>0.30</mn><mo>×</mo>${dollars(lung.commercial)}<mo>−</mo>${dollars(-lung.development)}`,`<mo>≈</mo>${dollars(lung.rnpv)}`)),
      '<i>P</i> is the present value of commercial profits if program <i>j</i> succeeds, using the same discounting and tax assumptions. <i>C</i> is the present value of its scheduled development spending. Dollar amounts in the lung example are in millions. I multiply the commercial value by success probability; I deduct the development costs in full. The example uses rounded values.'),
    label:card('How I allow for risk to the existing label',
      math('Expected label loss equals one minus 301 success probability times conditional withdrawal probability times fraction of core value lost times core value',`<mi>L</mi><mo>=</mo><mo>(</mo><mn>1</mn><mo>−</mo>${sub('p','301')}<mo>)</mo><mo>×</mo><mi>q</mi><mo>×</mo><mi>λ</mi><mo>×</mo>${vc}`)+
      math('The central label loss is 50 percent times 20 percent times 70 percent of core value',lines(`<mi>L</mi><mo>=</mo><mn>0.50</mn><mo>×</mo><mn>0.20</mn><mo>×</mo><mn>0.70</mn><mo>×</mo>${vc}`,`<mo>≈</mo>${dollars(coreLoss)}<mtext>M</mtext>`)),
      '<i>q</i> is my assumed chance of withdrawal if 301 fails. <i>λ</i> is the fraction of core value lost on withdrawal. This is a deduction of 7% of core value in my base case. The same 301 outcome also determines whether the frontline program succeeds.'),
    equity:card('How the pieces become a value per share',
      math('Equity equals core value minus label loss plus pipeline values plus option value minus corporate cost plus net cash minus one time costs',lines(`<mi>E</mi><mo>=</mo>${vc}<mo>−</mo><mi>L</mi><mo>+</mo>${sum('j')}${npv}`,`<mo>+</mo><mi>O</mi><mo>−</mo><mi>K</mi><mo>+</mo><mi>B</mi><mo>−</mo><mi>X</mi>`))+
      math('Value per share equals equity value divided by diluted shares, approximately 5 dollars and 83 cents',`${share}<mo>=</mo><mfrac><mi>E</mi><mi>N</mi></mfrac><mo>≈</mo><mfrac>${dollars(equity)}<mn>${shares}</mn></mfrac><mo>≈</mo>${dollars(equity/shares)}`),
      '<i>O</i> is the next-generation option ($100M); <i>K</i> is the present value of corporate costs; <i>B</i> is assumed net cash ($240M); and <i>X</i> is any one-time scenario cost, zero in the base case. <i>N</i> is 475M diluted shares. Equity is in $M and shares are in millions, so the division gives dollars per share.'),
    reverse:card('The equation I solve backward',
      math('Find peak core sales such that value per share equals 8 dollars and 48 cents',`${share}<mo>(</mo>${sub('R','peak')}<mo>)</mo><mo>=</mo><mtext>$8.48</mtext>`),
      `I change only peak core sales in the single-path test until the value reaches $8.48. That gives about $${peak.toLocaleString('en-US',{maximumFractionDigits:0})}M of peak sales. I keep the pipeline, margins, share count, cash, and discount rate fixed for this test.`),
    simulation:card('How a simulated outcome becomes a value',
      math('Simulated equity equals simulated core value adjusted for withdrawal plus successful program profits minus development spending plus option value minus corporate costs plus cash',lines(`${sub('E','sim')}<mo>=</mo>${sub('V','core,sim')}<mo>(</mo><mn>1</mn><mo>−</mo><mn>0.70</mn>${sub('I','withdraw')}<mo>)</mo>`,`<mo>+</mo>${sum('j')}<mo>(</mo>${sub('I','j')}${sub('P','j,sim')}<mo>−</mo>${sub('C','j')}<mo>)</mo>`,`<mo>+</mo><mi>O</mi><mo>−</mo><mi>K</mi><mo>+</mo><mi>B</mi>`))+
      math('Simulated value per share equals simulated equity divided by diluted shares',`${sub('V','sim')}<mo>=</mo><mfrac>${sub('E','sim')}<mi>N</mi></mfrac>`),
      '<i>I</i> is 1 when an event occurs and 0 otherwise. A program earns commercial value only when its success indicator is 1. The withdrawal indicator can be 1 only when 301 fails, followed by a withdrawal draw. Core value and conditional commercial values vary across draws; development costs, option value, corporate costs, cash, and shares stay fixed in this central-case simulation.')
  };
}
