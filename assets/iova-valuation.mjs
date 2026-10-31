import {BASE,SHARES,CASH,REFERENCE_PRICE,PART_LABELS,clone,value,adverseSafety,optimistic,reversePeak} from './iova-valuation-model.mjs';

export const defaults={scenario:'central',rate:10,pos:50,margin:0,shares:SHARES,cash:CASH};
export const money=n=>`${n<0?'−':''}$${Math.abs(n).toFixed(2)}`;
const scenarioAssumptions=scenario=>scenario==='optimistic'?optimistic():scenario==='safety'?adverseSafety():clone(BASE);
export function explore(v=defaults){
  const a=scenarioAssumptions(v.scenario);a.pipe.frontline.pos=v.pos/100;a.marginShift=v.margin/100;
  return {...value(a,v.rate/100,v.shares,v.cash),peak:reversePeak(REFERENCE_PRICE,a,v.rate/100,v.shares,v.cash)};
}
export function renderBreakdown(parts,shares=SHARES){
  const max=Math.max(...Object.values(parts).map(Math.abs))/shares;
  return `<div class="value-breakdown" role="list" aria-label="Value components in dollars per diluted share">${Object.entries(parts).filter(([,n])=>Math.abs(n)>.001).map(([k,n])=>{
    const amount=n/shares,width=Math.abs(amount)/max*100;
    return `<div class="value-part" role="listitem"><span>${PART_LABELS[k]}</span><div class="value-track" aria-hidden="true"><span class="negative-half">${amount<0?`<i style="width:${width}%"></i>`:''}</span><span class="positive-half">${amount>=0?`<i style="width:${width}%"></i>`:''}</span></div><strong>${money(amount)}</strong></div>`;
  }).join('')}</div>`;
}
export function renderComparison(current){
  const rows=[['My original estimate',value().perShare],['Your assumptions',current],['Price used in this case',REFERENCE_PRICE]];
  const max=Math.max(...rows.map(([,n])=>Math.abs(n)),1);
  return `<div class="valuation-comparison">${rows.map(([label,n],i)=>`<div class="comparison-row"><div><span>${label}</span><strong>${money(n)}</strong></div><div class="comparison-track" aria-hidden="true"><i class="comparison-${i}" style="width:${Math.abs(n)/max*100}%"></i></div></div>`).join('')}</div>`;
}
const controls=[['rate','Discount rate',6,16,.5,'%'],['pos','TILVANCE-301 success probability',0,100,5,'%'],['margin','Core margin change',-10,10,1,' pp'],['shares','Diluted shares',400,650,5,'M'],['cash','Net cash',0,500,10,'M']];
const formatControl=(k,n,suffix)=>k==='cash'?`$${n}${suffix}`:k==='margin'?`${n>0?'+':''}${n}${suffix}`:`${n}${suffix}`;
function control([key,label,min,max,step,suffix]){return `<div class="lab-control"><label for="valuation-${key}">${label}<output for="valuation-${key}" data-control-value="${key}">${formatControl(key,defaults[key],suffix)}</output></label><input id="valuation-${key}" data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${defaults[key]}" disabled></div>`;}
export function renderExplorer(){
  const result=explore();
  return `<section id="explore" class="learning-lab valuation-explorer" data-valuation-explorer aria-labelledby="explore-title"><p class="kicker">Try your own assumptions</p><h2 id="explore-title">Where would you disagree with me?</h2><p>If you think I am too cautious, change the numbers below. You can see how much better margins or a higher chance of success would add to the value.</p><div class="lab-control scenario-control"><label for="valuation-scenario">Start from</label><select id="valuation-scenario" data-key="scenario" disabled><option value="central">My base assumptions</option><option value="optimistic">Better operating results</option><option value="safety">Hypothetical adverse safety</option></select></div><div class="lab-controls">${controls.slice(0,3).map(control).join('')}</div><details><summary>Capital structure assumptions</summary><div class="lab-controls">${controls.slice(3).map(control).join('')}</div><p class="muted">If more money is raised, remember to change both the cash and the number of shares. Moving one slider does not adjust the other.</p></details><div class="explorer-result" aria-live="polite" aria-atomic="true" data-explorer-summary>${renderSummary(result)}</div><figure class="lab-figure"><div data-valuation-comparison>${renderComparison(result.perShare)}</div><figcaption class="lab-lesson">I use $8.48 from my 30 October notes for comparison. The calculator does not fetch live prices. My written estimate above stays at $5.83 as you try different inputs.</figcaption></figure><details><summary>See where this value comes from</summary><div data-explorer-parts>${renderBreakdown(result.parts)}</div></details><button type="button" class="lab-reset" data-valuation-reset disabled>Reset to my assumptions</button><noscript><p>The central-case graphic is shown. JavaScript enables the scenario controls. The complete assumptions and downloadable Python model remain available below.</p></noscript></section>`;
}
function renderSummary(result){
  const diff=(result.perShare/REFERENCE_PRICE-1)*100;
  return `<p><span>Value with these assumptions</span><strong>${money(result.perShare)}<small> / diluted share</small></strong></p><p>${Math.abs(diff).toFixed(1)}% ${diff<0?'below':'above'} the $8.48 comparison. To reach that price, this calculation needs ${result.peak===null?'a peak outside the calculator range':`$${(result.peak/1000).toFixed(2)}B in peak annual core revenue`} under these assumptions.</p>`;
}
if(typeof document!=='undefined'){
  const root=document.querySelector('[data-valuation-explorer]');
  if(root){
    const inputs=[...root.querySelectorAll('[data-key]')];
    function read(){return Object.fromEntries(inputs.map(input=>[input.dataset.key,input.dataset.key==='scenario'?input.value:Number(input.value)]));}
    function update(){
      const v=read(),result=explore(v);
      for(const [key,,,,,suffix] of controls)root.querySelector(`[data-control-value="${key}"]`).textContent=formatControl(key,v[key],suffix);
      root.querySelector('[data-explorer-summary]').innerHTML=renderSummary(result);
      root.querySelector('[data-valuation-comparison]').innerHTML=renderComparison(result.perShare);
      root.querySelector('[data-explorer-parts]').innerHTML=renderBreakdown(result.parts,v.shares);
    }
    for(const input of inputs){input.disabled=false;input.addEventListener('input',()=>{
      if(input.dataset.key==='scenario')root.querySelector('[data-key="pos"]').value=input.value==='optimistic'?60:50;
      update();
    });}
    const reset=root.querySelector('[data-valuation-reset]');reset.disabled=false;
    reset.addEventListener('click',()=>{for(const input of inputs)input.value=defaults[input.dataset.key];update();});
    root.dataset.valuationReady='true';
  }
}
