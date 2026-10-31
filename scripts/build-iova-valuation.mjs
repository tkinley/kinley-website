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
const snapshot={author:'Kinley Tenzin',asOf:'2026-10-30',version:'v2 web edition',currency:'USD',units:'Millions except per-share values and probabilities',referencePrice:REFERENCE_PRICE,referencePriceNote:'Dated input from the author’s notes; not a live or independently sourced closing quote.',discountRate:.10,dilutedShares:SHARES,assumedNetCash:CASH,assumptions:BASE,central,bridge:bridgeRows.map(({label,perShare,change})=>({label,perShare,change})),scenarios:{adverseSafety:safety.perShare,combinedDownside:value(down).perShare,optimistic:bull.perShare,optimisticRate8MarginsPlus5:value(friendly,.08).perShare},reverseDCF:{price:REFERENCE_PRICE,peakCoreRevenue:reversePeak()},sources:source};
await mkdir(path.join(root,'valuations'),{recursive:true});
await writeFile(path.join(root,'data','iova-valuation.json'),JSON.stringify(snapshot,null,2)+'\n');
const toc=[['view','My view'],['facts','Reported facts'],['method','How I value it'],['assumptions','My assumptions'],['parts','What drives value'],['explore','Try the model'],['revision','Why I revised it'],['scenarios','Downside and upside'],['reverse','What the price requires'],['uncertainty','The uncertainty'],['watch','What would change my mind'],['downloads','Sources and model']];
const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>$IOVA: my valuation case · Alea · Kinley Tenzin</title>
<meta name="description" content="Kinley Tenzin’s personal Iovance valuation: a $5.83 central rNPV case, transparent assumptions, reverse DCF, interactive scenarios, and a downloadable Python model. Snapshot: 30 October 2026.">
<meta name="author" content="Kinley Tenzin"><link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/research-notes.css?v=4"><link rel="stylesheet" href="../assets/valuation.css?v=1">
<script type="module" src="../assets/iova-valuation.mjs?v=1"></script>
</head>
<body>
<a class="skip" href="#main">Skip to the case</a>
<div class="wrap">
<nav class="textnav" aria-label="Pages"><a href="../index.html">Home</a><a href="../statistics.html" aria-current="location">Alea</a><a href="../statistics.html#my-valuations">My valuations</a></nav>
<header class="valuation-header">
<div class="dateline"><span>Kinley Tenzin · My valuations · Case 01</span><span>Opinion as of 30 October 2026, evening</span></div>
<p class="breadcrumb"><a href="../statistics.html#my-valuations">← My valuations in Alea</a></p>
<h1><span class="ticker">$IOVA · Iovance Biotherapeutics</span>A real franchise.<br>A demanding price.</h1>
<p class="lede">My central model values Iovance at <strong>${money(central.perShare)} per diluted share</strong>. Against the $8.48 reference in my notes, I need a stronger melanoma franchise, better economics, or more pipeline success to close the gap.</p>
<p class="opinion-label">By Kinley Tenzin · Personal opinion and illustrative assumptions · Published 31 October 2026</p>
<dl class="valuation-metrics"><div><dt>My central model value</dt><dd>${money(central.perShare)}</dd><small>Per share, using 475M diluted shares</small></div><div><dt>Modeled equity value</dt><dd>$${(central.equity/1000).toFixed(2)}B</dd><small>Cash flows through 2045; 10% discount rate</small></div><div><dt>Core peak implied by $8.48</dt><dd>$${(reversePeak()/1000).toFixed(2)}B</dd><small>Annual revenue in the reverse DCF</small></div></dl>
</header>
<main id="main" class="article-layout valuation-layout" tabindex="-1">
<aside class="toc" aria-label="Case contents"><span class="kicker">Inside the case</span><ol>${toc.map(([id,label])=>`<li><a href="#${id}">${label}</a></li>`).join('')}</ol></aside>
<article aria-label="My Iovance valuation">
<section id="view"><h2>My view: the core matters most</h2>
<p>I see a business with a commercial melanoma franchise and a promising but uncertain pipeline. A lower share price after a disappointing readout does not, by itself, make the shares cheap. My question is what future cash generation the price already requires.</p>
<p>In my central case, the approved melanoma franchise contributes ${money(central.parts.core/SHARES)} per share before a ${money(Math.abs(central.parts.labelRisk)/SHARES)} label-risk deduction. Lung cancer contributes only ${money(central.parts.lung/SHARES)}. That makes melanoma adoption, margins, competition, and TILVANCE-301 more consequential to my valuation than a modest change in the lung program.</p>
<p>My conclusion is cautious at the dated $8.48 reference. I can reach that price, but I have to use more favorable operating assumptions or a lower discount rate. This is my estimate under a chosen model, with substantial room for a different view.</p>
<p class="model-note">All amounts are U.S. dollars. This is a dated personal valuation, not investment advice or a live price target. The $8.48 reference comes from my supplied 30 October notes; I do not present it as an independently verified closing quote.</p>
</section>
<section id="facts"><h2>Start with what was reported</h2>
<p>I keep reported observations separate from the future I choose to model.</p>
${table('Reported observations and my use of them',['Reported observation','How I use it'],[
['Q2 2026 product revenue: $99.313M, including Amtagvi $90.721M and Proleukin $8.592M. <a href="'+source.quarter+'">June 2026 10-Q</a>.','Evidence of an operating franchise; not a forecast of peak sales.'],
['At 30 June: $303.7M in cash, equivalents, short-term investments and restricted cash, including $6.0M restricted; 452.971M basic shares and 32.731M common-stock equivalents. <a href="'+source.quarter+'">10-Q</a>.','My $240M net cash and 475M diluted shares are separate estimates, not reported balances.'],
['Management raised FY2026 revenue guidance to $410–420M on 29 September. <a href="'+source.guidance+'">Company release filed with the SEC</a>.','Subtracting H1 revenue of $170.743M implies about $120–125M per H2 quarter. This is arithmetic on guidance.'],
['IOV-LUN-202: 17/69 reported responses (15 confirmed, two unconfirmed); a retrospective enriched subgroup had 13/22. <a href="'+source.lung+'">29 October company update, SEC exhibit</a>.','I assign lung a 30% success probability. That is my judgment; 59.1% response is not 59.1% approval probability.'],
['The FDA approval letter provides for a confirmatory trial and possible withdrawal if benefit is not verified. <a href="'+source.label+'">FDA approval letter</a>.','I explicitly couple frontline success with risk to the existing accelerated approval.'],
['Replimune reported accelerated approval of TUDRIQEV (RP1) with nivolumab in August 2026. <a href="'+source.competitor+'">Replimune update</a>.','More competition supports my cautious scenario mix. The size of its impact remains my assumption.']
])}
<p>For the clinical denominators, subgroup selection, and uncertainty, read the separate <a href="../statistics/iovance-data-first.html">Iovance statistical case</a>. It explains why a striking selected response rate needs prospective validation.</p>
</section>
<section id="method"><h2>How I value the pieces</h2>
<p>I use a sum-of-the-parts risk-adjusted net present value, or rNPV. I discount three possible revenue-and-margin paths for the approved franchise, weight them, and add the pipeline after allowing for the chance that each program fails.</p>
<div class="formula">Equity = core DCF − expected label loss + pipeline rNPVs + next-generation option − corporate costs + net cash<br>Value per share = equity ÷ diluted shares</div>
<p>For a pipeline program, rNPV equals its success probability times the present value of commercial profits, less the present value of scheduled development spending. I charge that spending in full in this simplified model. I use a 10% discount rate alongside explicit clinical and regulatory probabilities, rather than adding an arbitrary extra premium for the same binary risks.</p>
<p>TILVANCE-301 affects two pieces together: the frontline opportunity and the existing label. At a 50% success probability, a 20% conditional withdrawal probability after failure, and a 70% core-value loss on withdrawal, the expected core haircut is 50% × 20% × 70% = <strong>7%</strong>. These three inputs are opinions, not FDA forecasts.</p>
<p>Cash flows run from 2027 to 2045, with mid-year discounting to approximately the end of 2026. I assume 21% cash tax on positive profits from 2033, no terminal value, no takeover premium, and $40M of annual unallocated corporate costs.</p>
</section>
<section id="assumptions"><h2>The assumptions I am making</h2>
${table('Approved-franchise scenarios: Amtagvi plus Proleukin',['Core path','Weight','Revenue path ($M)','Mature margin','Plateau / annual erosion'],[
['Bear','40%','2027: 520 → 580 → 620 → 2030: 650','35%','Through 2033 / 12%'],
['Base','45%','2027: 575 → 760 → 880 → 960 → 2031: 1,000','45%','Through 2035 / 10%'],
['Bull','15%','2027: 650 → 900 → 1,100 → 1,250 → 2031: 1,400','50%','Through 2036 / 8%']
])}
<p>Margins ramp in 2027–2029 before reaching those mature levels. Bear: 22%, 27%, 31%; base: 30%, 37%, 42%; bull: 33%, 40%, 46%. These are intended as cash-generation proxies after stock-based compensation and before the separate corporate-cost line.</p>
${table('Pipeline assumptions: probabilities are my judgments',['Program','Success','Launch / peak sales','Mature margin','Development spending ($M)'],[
['Frontline melanoma / TILVANCE-301','50%','2029 / $700M','45%','2027: 70; 2028: 70; 2029: 30'],
['Lung cancer','30%','2030 / $350M','40%','2027: 40; 2028: 40; 2029: 25'],
['Sarcoma','20%','2029 / $250M','40%','2027: 20; 2028: 20; 2029: 10'],
['Endometrial cancer','15%','2029 / $150M','40%','2027: 10; 2028: 10']
])}
<p>Each pipeline program ramps to peak revenue over five years, holds through 2038, then erodes 8% annually. Its margin starts at 15% and reaches its mature level three years after launch. Launch years are modeling choices, not company commitments.</p>
<p>I add a subjective $100M present-value option for next-generation programs and assume $240M of net cash and 475M diluted shares. The diluted count is an approximation, not simply basic shares plus every outstanding award. Future funding needs may change both cash and shares.</p>
</section>
<section id="parts"><h2>What drives the $5.83</h2>
<p>The large positive component is the melanoma franchise. Corporate spending and label risk offset some of that value. The smaller pipeline components matter, but they do not carry the central case.</p>
<figure><figcaption class="kicker">Dollars per diluted share · negative components extend left</figcaption>${renderBreakdown(central.parts)}</figure>
${partsTable}
<p class="model-note">Totals use unrounded values. Displayed components can differ from the total by a cent because of rounding.</p>
</section>
${renderExplorer()}
<section id="revision"><h2>Why I moved from $7.13 to $5.83</h2>
<p>The earlier model and the revision use the same framework. The changes below show how my judgments moved the result. A competitive development does not mechanically dictate a probability or revenue haircut; those are my translations into assumptions.</p>
<ol class="bridge-steps">${bridgeRows.map((row,i)=>`<li><strong>${money(row.perShare)}</strong> — ${row.label}${i?`<span>Change: ${money(row.change)} per share from the previous step.</span>`:''}</li>`).join('')}</ol>
<p>The largest revisions are the lower lung opportunity and a more cautious core scenario mix. I also assume faster long-term erosion, lower 2027 base revenue, more conditional label risk, and lower value for the other programs.</p>
</section>
<section id="scenarios"><h2>The ways I could be wrong</h2>
${table('Alternative assumption sets, not statistical confidence bounds',['Scenario','Value / diluted share','What changes'],[
['My central case',money(central.perShare),'The assumptions above.'],
['Hypothetical adverse safety',money(safety.perShare),'Lung wound down with $15M cost; sarcoma/endometrial probabilities halved; option $50M; one-time cost $100M; core value −5%.'],
['Combined downside',money(value(down).perShare),'Adverse safety assumptions plus 100% weight on the bear core path.'],
['Optimistic operating case',money(bull.perShare),'Core weights 25/50/25; 301 probability 60%; conditional withdrawal 15%; lung 45% / $600M peak / 2029; other pipeline and option restored to v1.'],
['Optimistic, 8% rate, margins +5 points',money(value(friendly,.08).perShare),'Same optimistic case with a lower discount rate and higher core margins.']
])}
<p>I do not assume undisclosed deaths or wrongdoing in the central case. A missing safety table cannot establish either. The adverse-safety row is a stress test of possible economic damage, not an allegation or evidence that the scenario occurred.</p>
<p>If I assign that stress case an illustrative 10% weight, the blended result is ${money(.9*central.perShare+.1*safety.perShare)}. That 10% is a chosen scenario weight. I would update it using actual safety disclosures, not an extrapolation of a melanoma death rate into a different lung-trial population.</p>
${table('One input at a time around the central case',['Input','Lower setting','Higher setting'],[
['Discount rate','8% → '+money(value(BASE,.08).perShare),'12% → '+money(value(BASE,.12).perShare)],
['TILVANCE-301 probability','35% → '+money(posValue(.35)),'65% → '+money(posValue(.65))]
])}
<p>Setting lung commercial value to zero while allowing $15M of wind-down spending gives ${money(value(lungZero).perShare)}. This illustrates why my main valuation debate remains the core franchise and frontline program.</p>
</section>
<section id="reverse"><h2>What does $8.48 already require?</h2>
<p>I reverse the calculation: keep the v2 pipeline and base margin assumptions, and solve for the core revenue peak that makes the model equal the reference price. The single core path starts at $575M in 2027, rises linearly to its peak in 2031, stays flat through 2035, then declines 10% annually.</p>
<div class="result"><span class="value">About $${(reversePeak()/1000).toFixed(2)}B in annual core revenue</span>Required to support $8.48 per diluted share under this particular reverse DCF.</div>
<p>A single path reaching $1.0B gives ${money(singleCoreValue(1000))} per share with the same pipeline. This is a different construction from the weighted three-path central case. Under the adverse-safety assumptions, $8.48 instead requires about $${(reversePeak(REFERENCE_PRICE,adverseSafety())/1000).toFixed(2)}B of peak core revenue.</p>
<p>I can also close much of the gap with more favorable assumptions: the optimistic operating case is ${money(value(optimistic(),.09).perShare)} at 9% and ${money(value(optimistic(),.08).perShare)} at 8%. That is why I see the disagreement as one about growth, economics, and required return.</p>
<p class="model-note">The implied peak is conditional on this revenue path, margins, pipeline, capital structure, and discount rate. It does not reveal what every market participant believes. I omit an infusion-count conversion because it would require extra assumptions about net price and the Amtagvi/Proleukin mix.</p>
</section>
<section id="uncertainty"><h2>A distribution, with its assumptions visible</h2>
<p>The supplied Python simulation produces a median of <strong>$5.69</strong> and a 10th–90th percentile range of <strong>$2.17–$9.50</strong> for 200,000 draws with independent program events. About 17% of draws exceed $8.48. Those are outputs of my selected distributions, not an objective 17% probability that the market price will rise.</p>
<p>With a shared latent-normal factor of 0.5 across program events, the range widens to $1.92–$9.78, with a $5.66 median and about 18% above the reference. The latent correlation input is not the same as the realized correlation of binary approval outcomes.</p>
<details><summary>How the simulation is constructed</summary><p>Seed 11; 200,000 draws. Core value uses a lognormal revenue multiplier (log standard deviation 0.32) scaled to preserve the expected core PV, plus a normal margin shift with 5 percentage points standard deviation. Program success is binary, with probabilities from the model. Conditional peak sales are lognormal, with log standard deviation 0.5 for frontline and 0.6 for other programs. The same frontline event drives the label-withdrawal branch. Development spending, net cash, corporate costs, and the next-generation option remain fixed. The model omits many real-world dependencies and financing paths.</p></details>
<p>The DCF also has practical limits. Revenue times margin is a proxy for cash flow; capex, working capital, restricted cash, taxes, and future financing need a fuller treatment. I assume 475M shares throughout. Stopping in 2045 suppresses residual value, while omitted funding needs can push in the other direction. These simplifications can materially change the answer.</p>
</section>
<section id="watch"><h2>What would change my mind?</h2>
<ul><li><strong>Commercial execution:</strong> revenue against the roughly $120–125M quarterly H2 guidance requirement; patient throughput, referral trends, and gross margin. Growth needs to become durable cash generation.</li>
<li><strong>The balance sheet:</strong> actual cash, restricted cash, share count, and any financing after June. I would replace the $240M and 475M estimates before relying on a fresh per-share result.</li>
<li><strong>Lung durability and safety:</strong> duration of response, grade 5 events with attribution, denominators, follow-up, and outcomes by lymphodepletion regimen. Prospective validation matters more than a selected subgroup alone.</li>
<li><strong>TILVANCE-301:</strong> its efficacy and safety evidence. This changes both frontline value and the confirmatory-risk deduction on the existing franchise.</li>
<li><strong>Competition:</strong> actual uptake and evidence from alternatives. I would revise the scenario weights and erosion assumptions as those effects become observable.</li></ul>
<p>My valuation is a set of commitments I can revisit: which evidence would make me change the sales path, margins, success probabilities, or share count? A new headline should move the line it actually affects.</p>
</section>
<section id="downloads"><h2>Sources and reproducible model</h2>
<p>This article is based on my 30 October 2026 evening valuation notes and v2 Python model. The web edition preserves the valuation arithmetic and labels the safety stress case as hypothetical. The executed clinical companion notebook remains in the <a href="../statistics/iovance-data-first.html#sources">statistical case study</a>.</p>
<div class="actions"><a class="button primary" href="../models/iova_rnpv_model.py" download>Download valuation model (.py)</a><a class="button" href="../data/iova-valuation.json" download>Download assumptions and results (.json)</a></div>
<p class="model-note">Run with Python 3.10+ and NumPy: <code>python iova_rnpv_model.py</code>. The browser calculator uses the same deterministic assumptions. Simulation results are generated by the Python model.</p>
<ul class="sources"><li><a href="${source.quarter}">Iovance Form 10-Q, quarter ended 30 June 2026</a> — revenue, cash composition, and capital structure.</li><li><a href="${source.guidance}">Iovance guidance update, 29 September 2026, SEC Exhibit 99.1</a>.</li><li><a href="${source.lung}">Iovance IOV-LUN-202 update, 29 October 2026</a>.</li><li><a href="${source.label}">FDA Amtagvi approval letter, 16 February 2024</a> — confirmatory obligations and withdrawal provisions.</li><li><a href="${source.competitor}">Replimune corporate update, 14 August 2026</a> — TUDRIQEV approval.</li></ul>
<p>Reported facts support the starting point. My revenue paths, launch dates, margins, probabilities, discount rate, scenario weights, and resulting valuation are my opinion.</p>
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
