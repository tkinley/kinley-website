import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {BASE,SHARES,CASH,REFERENCE_PRICE,PART_LABELS,clone,value,adverseSafety,optimistic,reversePeak,singleCoreValue,bridge} from '../assets/iova-valuation-model.mjs';
import {money,renderBreakdown,renderExplorer} from '../assets/iova-valuation.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const central=value(),safety=value(adverseSafety()),bull=value(optimistic());
const down=adverseSafety();down.weights={bear:1,base:0,bull:0};
const friendly=optimistic();friendly.marginShift=.05;
const lungZero=clone(BASE);lungZero.pipe.lung.pos=0;lungZero.pipe.lung.dev={2027:15};
const posValue=p=>{const a=clone(BASE);a.pipe.frontline.pos=p;return value(a).perShare;};
const source={
  quarter:'https://www.sec.gov/Archives/edgar/data/1425205/000110465926091716/iova-20260630x10q.htm',
  guidance:'https://www.sec.gov/Archives/edgar/data/1425205/000110465926111583/tm2626507d1_ex99-1.htm',
  lung:'https://www.sec.gov/Archives/edgar/data/1425205/000110465926120261/tm2628468d1_ex99-1.htm',
  label:'https://www.fda.gov/media/176418/download',
  competitor:'https://replimune.gcs-web.com/news-releases/news-release-details/replimune-reports-fiscal-first-quarter-2027-financial-results'
};
const table=(caption,head,rows)=>`<div class="table-scroll" role="region" aria-label="${caption}" tabindex="0"><table><caption>${caption}</caption><thead><tr>${head.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>i?`<td>${cell}</td>`:`<th scope="row">${cell}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const partsTable=table('Central case: present values, USD millions and dollars per diluted share',['Component','PV ($M)','$/share'],Object.entries(central.parts).filter(([,n])=>Math.abs(n)>.001).map(([k,n])=>[PART_LABELS[k],n.toFixed(1),money(n/SHARES)]).concat([['Equity value',central.equity.toFixed(1),money(central.perShare)]]));
const bridgeRows=bridge();
const revisionNotes=[
  ['Where I started','My earlier assumptions gave me $7.13 per share.'],
  ['I lowered my lung assumptions','The broader response rate and the selected subgroup leave me wanting more evidence on durability and prospective results. I lowered success from 45% to 30%, cut peak sales from $500M to $350M, moved launch to 2030, and allowed more development spending.'],
  ['I put more weight on weaker melanoma sales','With another approved treatment competing for patients, I am less comfortable giving the strongest sales path a large weight. My bear/base/bull weights move from 30/50/20 to 40/45/15.'],
  ['I allowed sales to fade faster after their peak','I expect competition to matter over time. I added two percentage points to the annual decline after peak sales in each core scenario. The size of that effect is my judgment.'],
  ['I lowered my 2027 base revenue estimate','I moved from $600M to $575M. That still assumes substantial growth from the midpoint of 2026 guidance.'],
  ['I allowed more risk to the existing label','If 301 fails, I use a 20% conditional chance of withdrawal rather than 15%. I think it is worth allowing for a less favorable regulatory outcome, although the FDA has not assigned either probability.'],
  ['I gave the other programs less value','I lowered sarcoma success to 20%, endometrial success to 15%, and the next-generation option to $100M. I want each program to earn more value with its own evidence.']
];
const snapshot={author:'Kinley Tenzin',asOf:'2026-10-30',version:'v2 web edition',currency:'USD',units:'Millions except per-share values and probabilities',referencePrice:REFERENCE_PRICE,referencePriceNote:'Dated input from the author’s notes; not a live or independently sourced closing quote.',discountRate:.10,dilutedShares:SHARES,assumedNetCash:CASH,assumptions:BASE,central,bridge:bridgeRows.map(({label,perShare,change})=>({label,perShare,change})),scenarios:{adverseSafety:safety.perShare,combinedDownside:value(down).perShare,optimistic:bull.perShare,optimisticRate8MarginsPlus5:value(friendly,.08).perShare},reverseDCF:{price:REFERENCE_PRICE,peakCoreRevenue:reversePeak()},sources:source};
await mkdir(path.join(root,'valuations'),{recursive:true});
await writeFile(path.join(root,'data','iova-valuation.json'),JSON.stringify(snapshot,null,2)+'\n');
const toc=[['view','Why I think this'],['facts','What I start from'],['method','How I work it out'],['assumptions','Why these assumptions'],['parts','Where the value comes from'],['explore','Try your assumptions'],['revision','Why I lowered my estimate'],['scenarios','Where I could be wrong'],['reverse','Why $8.48 is harder to justify'],['uncertainty','How uncertain I am'],['watch','What would change my mind'],['downloads','Sources and model']];
const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>$IOVA: why I value it at $5.83 · Alea · Kinley Tenzin</title>
<meta name="description" content="Why I get $5.83 per share for Iovance: my view on melanoma sales, the lung data, competition, and what would change my mind. By Kinley Tenzin, based on 30 October 2026 assumptions.">
<meta name="author" content="Kinley Tenzin"><link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/research-notes.css?v=4"><link rel="stylesheet" href="../assets/valuation.css?v=1">
<script type="module" src="../assets/iova-valuation.mjs?v=2"></script>
</head>
<body>
<a class="skip" href="#main">Skip to the case</a>
<div class="wrap">
<nav class="textnav" aria-label="Pages"><a href="../index.html">Home</a><a href="../statistics.html" aria-current="location">Alea</a><a href="../statistics.html#my-valuations">My valuations</a></nav>
<header class="valuation-header">
<div class="dateline"><span>Kinley Tenzin · My valuations · Case 01</span><span>Opinion as of 30 October 2026, evening</span></div>
<p class="breadcrumb"><a href="../statistics.html#my-valuations">← My valuations in Alea</a></p>
<h1><span class="ticker">$IOVA · Iovance Biotherapeutics</span>Why I value Iovance at $5.83</h1>
<p class="lede">I think most of Iovance’s value still comes from melanoma. The lung data made me more cautious, but the bigger question for me is how much the melanoma business can earn. With the assumptions below, I get <strong>${money(central.perShare)} per diluted share</strong>. Here is why.</p>
<p class="opinion-label">By Kinley Tenzin · My opinion, based on 30 October 2026 assumptions · Published 31 October 2026</p>
<dl class="valuation-metrics"><div><dt>My central model value</dt><dd>${money(central.perShare)}</dd><small>Per share, using 475M diluted shares</small></div><div><dt>Modeled equity value</dt><dd>$${(central.equity/1000).toFixed(2)}B</dd><small>Cash flows through 2045; 10% discount rate</small></div><div><dt>Core peak implied by $8.48</dt><dd>$${(reversePeak()/1000).toFixed(2)}B</dd><small>Annual revenue in the reverse DCF</small></div></dl>
</header>
<main id="main" class="article-layout valuation-layout" tabindex="-1">
<aside class="toc" aria-label="Case contents"><span class="kicker">Inside the case</span><ol>${toc.map(([id,label])=>`<li><a href="#${id}">${label}</a></li>`).join('')}</ol></aside>
<article aria-label="My Iovance valuation">
<section id="view"><h2>Why I am still cautious</h2>
<p>I do not think the fall in IOVA’s share price is enough to say it is cheap. I want to know how much the business could earn and how much of that future I am already paying for.</p>
<p>The part I give the most value to is the approved melanoma business: Amtagvi and Proleukin. Together, they contribute ${money(central.parts.core/SHARES)} per share before I deduct ${money(Math.abs(central.parts.labelRisk)/SHARES)} for risk to the existing label. Lung cancer adds only ${money(central.parts.lung/SHARES)} in my model.</p>
<p>That is why I keep coming back to melanoma. How many patients can Iovance treat? What margin can it make? How much demand could competing treatments take? And what happens if TILVANCE-301 disappoints? Those questions move my valuation much more than a small change in the lung assumptions.</p>
<p>At the $8.48 price I used in my notes, I think I would already be paying for a better outcome than my base assumptions support. I can get to that price, but I need stronger sales, higher margins, better pipeline results, or a lower required return. I want to be clear about which of those I am assuming before calling the shares undervalued.</p>
<p class="model-note">This is my opinion as of 30 October 2026, not investment advice. All amounts are U.S. dollars. I use $8.48 from my notes as a comparison; it is not a live quote or an independently verified closing price.</p>
</section>
<section id="facts"><h2>What I am starting from</h2>
<p>These are the reported numbers I use. The right-hand column is how I interpret them.</p>
${table('The reported numbers and why I care',['What was reported','Why it matters to me'],[
['Q2 2026 product revenue: $99.313M, including Amtagvi $90.721M and Proleukin $8.592M. <a href="'+source.quarter+'">June 2026 10-Q</a>.','There is already a business to value. My main question is how far sales can grow and how much profit they can produce.'],
['At 30 June: $303.7M in cash, equivalents, short-term investments and restricted cash, including $6.0M restricted; 452.971M basic shares and 32.731M common-stock equivalents. <a href="'+source.quarter+'">10-Q</a>.','Cash and dilution matter to what each share is worth. I use $240M net cash and 475M diluted shares as estimates that need updating.'],
['Management raised FY2026 revenue guidance to $410–420M on 29 September. <a href="'+source.guidance+'">Company release filed with the SEC</a>.','After H1 revenue of $170.743M, this implies roughly $120–125M per quarter in H2. That gives me a number to check the next results against.'],
['IOV-LUN-202: 17/69 reported responses (15 confirmed, two unconfirmed); a retrospective enriched subgroup had 13/22. <a href="'+source.lung+'">29 October company update, SEC exhibit</a>.','The subgroup interests me, but I want to see it hold up in new patients. I use a 30% chance of success for lung; the response rate does not tell me that probability.'],
['The FDA approval letter provides for a confirmatory trial and possible withdrawal if benefit is not verified. <a href="'+source.label+'">FDA approval letter</a>.','A failed 301 trial could affect both the new frontline opportunity and the existing label. I account for both.'],
['Replimune reported accelerated approval of TUDRIQEV (RP1) with nivolumab in August 2026. <a href="'+source.competitor+'">Replimune update</a>.','I think another treatment option makes the strongest melanoma sales path less certain. How much it affects Iovance is still my judgment.']
])}
<p>I go through the 13/22 result in more detail in the <a href="../statistics/iovance-data-first.html">clinical-data case</a>. My concern is how much of that response rate will repeat after selecting the subgroup from the results already observed.</p>
</section>
<section id="method"><h2>How I work out the value</h2>
<p>I start with the approved melanoma business. I estimate sales and margins under three different outcomes, work out what the future profits are worth today, and give each outcome a weight. Then I add the other programs, allowing for the chance that they fail.</p>
<p>This is a sum-of-the-parts risk-adjusted net present value, or rNPV. The reason I use it is that an approved product and an experimental program should not get the same treatment in the calculation.</p>
<div class="formula">Equity = core DCF − expected label loss + pipeline rNPVs + next-generation option − corporate costs + net cash<br>Value per share = equity ÷ diluted shares</div>
<p>For each experimental program, I take the value of profits if it succeeds, multiply by my assumed chance of success, and subtract development spending. I charge the scheduled development costs in full here. That is a simplification: I have not modeled every possible stopping point along the way.</p>
<p>I use a 10% discount rate as my required return. I already account for clinical and regulatory failure through the success probabilities, so I do not add another large discount-rate penalty for the same risk.</p>
<p>301 is especially important to me because it affects two parts of the value. Success could add frontline melanoma sales. Failure could also put the existing accelerated approval at risk. I use a 50% chance of success, a 20% chance of withdrawal if it fails, and a 70% loss of core value if withdrawal happens. That gives an expected deduction of 50% × 20% × 70% = <strong>7% of core value</strong>. These are my assumptions; they are not probabilities supplied by the FDA.</p>
<p>I value cash flows from 2027 through 2045, discounted to roughly the end of 2026. I allow $40M a year for corporate costs and 21% cash tax on positive profits from 2033. I add no takeover premium and no value for cash flows after 2045.</p>
</section>
<section id="assumptions"><h2>Why I chose these assumptions</h2>
<p>My base sales path reaches $1B a year for Amtagvi and Proleukin together. I think it is worth allowing for that outcome, but I am not comfortable giving it all the weight. Competition and the work needed to treat more patients are why I also give meaningful weight to a weaker result.</p>
${table('Approved-franchise scenarios: Amtagvi plus Proleukin',['Core path','Weight','Revenue path ($M)','Mature margin','Plateau / annual erosion'],[
['Bear','40%','2027: 520 → 580 → 620 → 2030: 650','35%','Through 2033 / 12%'],
['Base','45%','2027: 575 → 760 → 880 → 960 → 2031: 1,000','45%','Through 2035 / 10%'],
['Bull','15%','2027: 650 → 900 → 1,100 → 1,250 → 2031: 1,400','50%','Through 2036 / 8%']
])}
<p>For 2027, I use $575M in the base case. That is already about 39% above the $415M midpoint of 2026 guidance. I am still assuming strong growth; I just think $575M is a more cautious starting point than the $600M I used earlier.</p>
<p>I also allow margins to improve as the business grows. My base case eventually reaches 45%. That is an assumption I would want the company’s results to support over time. A sales forecast is not enough if manufacturing and operating costs absorb too much of the revenue.</p>
<p>The margin assumptions for 2027–2029 are 22%, 27%, 31% in the bear case; 30%, 37%, 42% in the base case; and 33%, 40%, 46% in the bull case. They then reach the mature levels above. I treat these margins as a rough measure of cash generation after stock-based compensation, with corporate costs deducted separately.</p>
${table('Pipeline assumptions: probabilities are my judgments',['Program','Success','Launch / peak sales','Mature margin','Development spending ($M)'],[
['Frontline melanoma / TILVANCE-301','50%','2029 / $700M','45%','2027: 70; 2028: 70; 2029: 30'],
['Lung cancer','30%','2030 / $350M','40%','2027: 40; 2028: 40; 2029: 25'],
['Sarcoma','20%','2029 / $250M','40%','2027: 20; 2028: 20; 2029: 10'],
['Endometrial cancer','15%','2029 / $150M','40%','2027: 10; 2028: 10']
])}
<p>For lung, I use 30% success, $350M peak sales, and a 2030 launch. The 13/22 subgroup gives me a reason to keep some value here. But the overall 17/69 result, the retrospective selection, and the need for clearer durability and safety data make me cautious about assigning a much larger opportunity.</p>
<p>I use 20% for sarcoma and 15% for endometrial cancer because I want each program to show its own evidence. I do not assume that success in melanoma automatically carries over to another cancer. The exact percentages are judgment calls; the response data do not produce them for me.</p>
<p>For each pipeline program, I assume a five-year ramp to peak sales, a plateau through 2038, and an 8% annual decline after that. Margins start at 15% and reach the mature level three years after launch. Those dates and ramps are assumptions I use to calculate value.</p>
<p>I give the next-generation programs a combined $100M of value. I see them as possible upside, but I am not ready to build a large sales forecast around them. This is one of the more subjective parts of the model.</p>
<p>Finally, I use $240M net cash and 475M diluted shares. Both need updating as new reports come out. If Iovance raises more money, I need to consider the cash received and the additional shares together.</p>
</section>
<section id="parts"><h2>Where my $5.83 comes from</h2>
<p>This breakdown is why I focus so much on melanoma. The approved business is the largest part of my estimate. The pipeline adds value, while corporate spending and the risk to the existing label bring it down.</p>
<figure><figcaption class="kicker">Dollars per diluted share · negative components extend left</figcaption>${renderBreakdown(central.parts)}</figure>
${partsTable}
<p class="model-note">Totals use unrounded values. Displayed components can differ from the total by a cent because of rounding.</p>
</section>
${renderExplorer()}
<section id="revision"><h2>Why I moved from $7.13 to $5.83</h2>
<p>I lowered several assumptions in the evening update. Here is what I changed, why I changed it, and how much each change took off the valuation.</p>
<ol class="bridge-steps">${bridgeRows.map((row,i)=>`<li><strong>${money(row.perShare)}</strong> — ${revisionNotes[i][0]}<p>${revisionNotes[i][1]}</p>${i?`<span>${money(row.change)} per share from this change.</span>`:''}</li>`).join('')}</ol>
<p>Most of the reduction came from giving lung less value and being more cautious about melanoma sales. I have kept the changes separate so it is possible to disagree with one of them without rejecting the whole calculation.</p>
</section>
<section id="scenarios"><h2>Where I could be wrong</h2>
<p>I could be underestimating the business. Better melanoma sales, stronger margins, and successful trials would all raise the value. I also want to know what a worse outcome could cost. These are the alternatives I tested.</p>
${table('Alternative assumption sets, not statistical confidence bounds',['Scenario','Value / diluted share','What changes'],[
['My central case',money(central.perShare),'The assumptions above.'],
['Hypothetical adverse safety',money(safety.perShare),'Lung wound down with $15M cost; sarcoma/endometrial probabilities halved; option $50M; one-time cost $100M; core value −5%.'],
['Combined downside',money(value(down).perShare),'Adverse safety assumptions plus 100% weight on the bear core path.'],
['Optimistic operating case',money(bull.perShare),'Core weights 25/50/25; 301 probability 60%; conditional withdrawal 15%; lung 45% / $600M peak / 2029; other pipeline and option restored to v1.'],
['Optimistic, 8% rate, margins +5 points',money(value(friendly,.08).perShare),'Same optimistic case with a lower discount rate and higher core margins.']
])}
<p>The adverse-safety case is hypothetical. I use it to see what the financial damage could look like if lung is wound down and the problems affect other parts of the business. I am not assuming undisclosed deaths or wrongdoing. A missing safety table would not establish either.</p>
<p>If I give that case a 10% weight, I get ${money(.9*central.perShare+.1*safety.perShare)}. I chose the 10% for the exercise. I would need actual safety disclosures to make a better judgment, including which patients were treated, their regimens, and what caused the events.</p>
${table('One input at a time around the central case',['Input','Lower setting','Higher setting'],[
['Discount rate','8% → '+money(value(BASE,.08).perShare),'12% → '+money(value(BASE,.12).perShare)],
['TILVANCE-301 probability','35% → '+money(posValue(.35)),'65% → '+money(posValue(.65))]
])}
<p>One result matters a lot to my thinking: if I remove all future lung sales and allow $15M to wind it down, I still get ${money(value(lungZero).perShare)}. That is close to my ${money(central.perShare)} estimate. So a much lower valuation needs more to go wrong than lung alone.</p>
</section>
<section id="reverse"><h2>Why $8.48 is harder for me to justify</h2>
<p>I also work backward from the price. I keep the pipeline and base margins the same, then ask how large the melanoma business would need to become for me to get $8.48 per share.</p>
<div class="result"><span class="value">About $${(reversePeak()/1000).toFixed(2)}B in annual core revenue</span>That is the peak sales level I need in this calculation to reach $8.48 per share.</div>
<p>For this test, sales start at $575M in 2027, rise steadily to the peak in 2031, stay there through 2035, and decline 10% a year afterward. A $1B peak gives me ${money(singleCoreValue(1000))} per share. This uses one sales path rather than the three weighted paths in my main estimate.</p>
<p>That is why I do not think “it can reach $1B in sales” settles the valuation. I still need to know the margins, how long sales last, the pipeline contribution, and how many shares there will be. Under the adverse-safety assumptions, reaching $8.48 would require about $${(reversePeak(REFERENCE_PRICE,adverseSafety())/1000).toFixed(2)}B in peak core sales.</p>
<p>There is another way to get there. My optimistic operating case gives ${money(value(optimistic(),.09).perShare)} at a 9% discount rate and ${money(value(optimistic(),.08).perShare)} at 8%. So someone who expects better execution and accepts a lower return can reasonably get a higher value than I do. Those are the assumptions I would want to discuss.</p>
<p class="model-note">The $1.50B figure depends on the rest of my inputs. It is what my calculation needs, rather than a claim about what every investor expects.</p>
</section>
<section id="uncertainty"><h2>How much confidence I put in the number</h2>
<p>I would not put much weight on the second decimal in $5.83. Sales, margins, trial outcomes, and dilution can each change the result. I use the number to make my assumptions clear and to see which ones matter most.</p>
<p>In 200,000 simulations with independent program outcomes, I get a median of <strong>$5.69</strong> and a 10th–90th percentile range of <strong>$2.17–$9.50</strong>. About 17% of the simulated values are above $8.48. That percentage depends on the distributions I chose; I would not read it as a 17% chance of the stock going up.</p>
<p>I also tested whether the programs might succeed or fail together. Using a shared latent-normal factor of 0.5 widens the range to $1.92–$9.78, with a $5.66 median and about 18% above $8.48. That 0.5 is a simulation setting, not a measured correlation between approvals.</p>
<details><summary>How the simulation is constructed</summary><p>Seed 11; 200,000 draws. Core value uses a lognormal revenue multiplier (log standard deviation 0.32) scaled to preserve the expected core PV, plus a normal margin shift with 5 percentage points standard deviation. Program success is binary, with probabilities from the model. Conditional peak sales are lognormal, with log standard deviation 0.5 for frontline and 0.6 for other programs. The same frontline event drives the label-withdrawal branch. Development spending, net cash, corporate costs, and the next-generation option remain fixed. The model omits many real-world dependencies and financing paths.</p></details>
<p>There are also parts I have simplified. I use revenue times margin as a rough measure of cash flow, rather than a full forecast of capital spending and working capital. Taxes, restricted cash, and future financing need more work. I hold the share count at 475M and stop the cash flows in 2045. I would revisit those choices before treating this as a fresh valuation at a later date.</p>
</section>
<section id="watch"><h2>What would change my mind?</h2>
<ul><li><strong>More patients treated, with better margins.</strong> I want to see revenue meet the roughly $120–125M quarterly H2 requirement implied by guidance. Sustained growth and improving margins would give me a reason to raise the melanoma assumptions.</li>
<li><strong>An updated cash and share count.</strong> I need to replace my $240M and 475M estimates with the latest numbers. More cash helps, but I also need to account for any shares issued to raise it.</li>
<li><strong>Clearer lung data.</strong> I want to see how long responses last, the full safety results, and outcomes by lymphodepletion regimen. If the selected subgroup performs well prospectively, I would have more reason to raise the lung probability.</li>
<li><strong>Better evidence from TILVANCE-301.</strong> That could raise frontline value and reduce my concern about the existing label. Disappointing results would push me the other way.</li>
<li><strong>Evidence of how competition affects demand.</strong> If Iovance keeps growing despite more treatment options, I would be more comfortable giving the stronger sales paths more weight.</li></ul>
<p>I am open to changing the $5.83. What I want is a reason to change a particular assumption. If the evidence improves, the valuation should improve with it.</p>
</section>
<section id="downloads"><h2>Sources and reproducible model</h2>
<p>I have included the model so you can change the assumptions and see where you disagree with me. This is the evening version of my 30 October 2026 valuation. The separate <a href="../statistics/iovance-data-first.html#sources">clinical-data case</a> includes the executed companion notebook.</p>
<div class="actions"><a class="button primary" href="../models/iova_rnpv_model.py" download>Download valuation model (.py)</a><a class="button" href="../data/iova-valuation.json" download>Download assumptions and results (.json)</a></div>
<p class="model-note">To run the model, use Python 3.10+ and NumPy: <code>python iova_rnpv_model.py</code>. The calculator on this page uses the same valuation assumptions. The simulations run in Python.</p>
<ul class="sources"><li><a href="${source.quarter}">Iovance Form 10-Q, quarter ended 30 June 2026</a> — revenue, cash composition, and capital structure.</li><li><a href="${source.guidance}">Iovance guidance update, 29 September 2026, SEC Exhibit 99.1</a>.</li><li><a href="${source.lung}">Iovance IOV-LUN-202 update, 29 October 2026</a>.</li><li><a href="${source.label}">FDA Amtagvi approval letter, 16 February 2024</a> — confirmatory obligations and withdrawal provisions.</li><li><a href="${source.competitor}">Replimune corporate update, 14 August 2026</a> — TUDRIQEV approval.</li></ul>
<p>The sources above are where I start. The sales paths, launch dates, margins, success probabilities, and valuation are my own assumptions and opinion.</p>
<p><a href="../statistics.html#my-valuations">← Back to My valuations</a> · <a href="../statistics/iovance-data-first.html">Read the clinical-data case →</a></p>
</section>
</article>
</main>
<footer><span>© 2026 Kinley Tenzin</span><a href="../index.html">Home</a><a href="../statistics.html">Alea</a><span>Personal analysis as of 30 October 2026.</span></footer>
</div>
</body></html>
`;
await writeFile(path.join(root,'valuations','iova.html'),html);
console.log(`Built IOVA opinion case: ${money(central.perShare)}/share; $${central.equity.toFixed(2)}M equity.`);
