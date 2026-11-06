// Sensitivity appendix written 1 November 2026; recalculated on 5 November with the Q3 cash, shares and price.
// The 1 November numbers are frozen in assets/archive/2026-11-01/.
import {BASE,SHARES,CASH,PART_LABELS,clone,value,program} from './iova-valuation-model.mjs?v=4';

export const AS_OF='2026-11-05';
export const METHOD_DATE='2026-11-01';
export const LOSS_IF_WITHDRAWN=.70;
export const JOINT_KEYS=Object.freeze(['both','orrOnly','confirmationOnly','neither']);
export const COUPLED_REFERENCE=Object.freeze({both:.5,orrOnly:0,confirmationOnly:0,neither:.5});
export const INDEPENDENT_ILLUSTRATION=Object.freeze({both:.25,orrOnly:.25,confirmationOnly:.25,neither:.25});

export function validateJointProbabilities(probabilities){
  if(!probabilities||typeof probabilities!=='object'||Array.isArray(probabilities))throw new TypeError('Provide the four joint-outcome probabilities.');
  if(Object.keys(probabilities).length!==4||JOINT_KEYS.some(key=>!Object.hasOwn(probabilities,key)))throw new TypeError('Use exactly both, orrOnly, confirmationOnly, and neither.');
  for(const key of JOINT_KEYS){
    const p=probabilities[key];
    if(typeof p!=='number'||!Number.isFinite(p)||p<0||p>1)throw new RangeError('Each probability must be a finite number between 0 and 1.');
  }
  const sum=JOINT_KEYS.reduce((total,key)=>total+probabilities[key],0);
  if(Math.abs(sum-1)>1e-10)throw new RangeError(`Joint probabilities must total 100%; received ${(sum*100).toFixed(2)}%.`);
  return Object.fromEntries(JOINT_KEYS.map(key=>[key,probabilities[key]]));
}

/**
 * ORR/frontline success and confirmation of existing-label benefit are distinct
 * modeled outcomes. Their joint probabilities are user assumptions, not estimates
 * from the 15/24 response count or a prediction of an FDA decision.
 *
 * Only two components change from value(): frontline rNPV and expected label loss.
 * Marginal frontline success = both + orrOnly.
 * Marginal confirmation failure = orrOnly + neither.
 */
export function joint301Value(probabilities=COUPLED_REFERENCE,assumptions=BASE,rate=.1,shares=SHARES,cash=CASH){
  const joint=validateJointProbabilities(probabilities);
  if(!Number.isFinite(rate)||rate<=-1)throw new RangeError('Discount rate must be finite and greater than -100%.');
  if(!Number.isFinite(shares)||shares<=0)throw new RangeError('Diluted shares must be positive and finite.');
  if(!Number.isFinite(cash))throw new RangeError('Cash must be finite.');
  if(!Number.isFinite(assumptions.pWithdraw)||assumptions.pWithdraw<0||assumptions.pWithdraw>1)throw new RangeError('Conditional withdrawal probability must be between 0 and 1.');
  const a=clone(assumptions),archived=value(a,rate,shares,cash);
  const frontlineSuccess=joint.both+joint.orrOnly;
  const confirmationSuccess=joint.both+joint.confirmationOnly;
  const confirmationFailure=joint.orrOnly+joint.neither;
  const parts={...archived.parts};
  parts.frontline=program({...a.pipe.frontline,pos:frontlineSuccess},rate).rnpv;
  parts.labelRisk=-confirmationFailure*a.pWithdraw*LOSS_IF_WITHDRAWN*parts.core;
  const equity=Object.values(parts).reduce((sum,n)=>sum+n,0);
  return {asOf:AS_OF,probabilities:joint,frontlineSuccess,confirmationSuccess,confirmationFailure,
    conditionalWithdrawal:a.pWithdraw,lossIfWithdrawn:LOSS_IF_WITHDRAWN,equity,perShare:equity/shares,
    parts,corePVs:archived.corePVs,archivedPerShare:archived.perShare,differencePerShare:equity/shares-archived.perShare};
}

const usd=n=>`${n<0?'−':''}$${Math.abs(n).toFixed(2)}`;
const labels={both:'Both outcomes succeed',orrOnly:'ORR/frontline only',confirmationOnly:'Confirmatory benefit only',neither:'Neither outcome succeeds'};
function resultMarkup(result){
  return `<p><strong>${usd(result.perShare)} per diluted share</strong> with these joint assumptions; ${usd(result.differencePerShare)} relative to my central model with otherwise identical inputs.</p><dl class="joint301-results"><div><dt>Frontline success marginal</dt><dd>${(result.frontlineSuccess*100).toFixed(1)}%</dd></div><div><dt>Confirmatory failure marginal</dt><dd>${(result.confirmationFailure*100).toFixed(1)}%</dd></div><div><dt>${PART_LABELS.frontline}</dt><dd>${usd(result.parts.frontline/SHARES)} / share</dd></div><div><dt>${PART_LABELS.labelRisk}</dt><dd>${usd(result.parts.labelRisk/SHARES)} / share</dd></div></dl>`;
}

export function renderJoint301Explorer(){
  const result=joint301Value();
  return `<section id="joint-301" class="learning-lab joint301-explorer" data-joint301-explorer aria-labelledby="joint301-title"><p class="kicker">Sensitivity appendix · written 1 November 2026 · recalculated with 5 November inputs</p><h2 id="joint301-title">Separate the trial outcomes</h2><p>The ORR interim analysis and the later confirmatory outcome need not have the same result. This sensitivity separates them while retaining the original cash flows, development costs, and conditional withdrawal assumptions. An ORR result is not itself a regulatory approval.</p><p class="model-note">These are illustrative joint probabilities, not estimates from the single-arm response data. They must total 100%. This appendix does not replace my central valuation of ${usd(value().perShare)}.</p><div class="lab-controls">${JOINT_KEYS.map(key=>`<div class="lab-control"><label for="joint301-${key}">${labels[key]} (%)</label><input type="number" id="joint301-${key}" data-joint-key="${key}" min="0" max="100" step="1" value="${COUPLED_REFERENCE[key]*100}" disabled></div>`).join('')}</div><div class="actions"><button type="button" data-joint-preset="coupled" disabled>Central-model coupling</button><button type="button" data-joint-preset="independent" disabled>Illustrative independence</button></div><div class="result" data-joint301-result role="status" aria-live="polite" aria-atomic="true">${resultMarkup(result)}</div><p class="model-note">The 50/0/0/50 reference preserves the historical coupling. The 25/25/25/25 example has the same 50% marginals and therefore the same expected value here. It does not imply the same risk distribution; no revised Monte Carlo distribution is calculated by this tool.</p><p class="model-note"><a href="../models/iova_trial_scenarios.py">Download the companion Python model</a> (keep the original model beside it) · <a href="../data/iova-trial-scenarios.json">Dated inputs and outcomes</a>.</p><noscript><p>The reference calculation is shown. Download the companion model to test other joint assumptions.</p></noscript></section>`;
}

export function initializeJoint301Explorers(scope=document){
  for(const root of scope.querySelectorAll('[data-joint301-explorer]')){
    if(root.dataset.joint301Ready)continue;
    const inputs=[...root.querySelectorAll('[data-joint-key]')],output=root.querySelector('[data-joint301-result]');
    function update(){
      try{
        const probabilities=Object.fromEntries(inputs.map(input=>[input.dataset.jointKey,input.value.trim()===''?NaN:Number(input.value)/100]));
        const result=joint301Value(probabilities);
        output.innerHTML=resultMarkup(result);output.removeAttribute('data-invalid');
      }catch(error){output.textContent=error.message;output.dataset.invalid='true';}
    }
    for(const input of inputs){input.disabled=false;input.addEventListener('input',update);}
    for(const button of root.querySelectorAll('[data-joint-preset]')){
      button.disabled=false;button.addEventListener('click',()=>{
        const probabilities=button.dataset.jointPreset==='independent'?INDEPENDENT_ILLUSTRATION:COUPLED_REFERENCE;
        for(const input of inputs)input.value=probabilities[input.dataset.jointKey]*100;
        update();
      });
    }
    root.dataset.joint301Ready='true';
  }
}
if(typeof document!=='undefined')initializeJoint301Explorers();
