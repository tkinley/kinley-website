import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AS_OF,METHOD_DATE,COUPLED_REFERENCE,INDEPENDENT_ILLUSTRATION,joint301Value} from '../assets/iova-trial-scenarios.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const scenarios={
  archivedCoupling:COUPLED_REFERENCE,
  illustrativeIndependence:INDEPENDENT_ILLUSTRATION,
  orrOnly:{both:0,orrOnly:1,confirmationOnly:0,neither:0},
  confirmationOnly:{both:0,orrOnly:0,confirmationOnly:1,neither:0},
  bothSucceed:{both:1,orrOnly:0,confirmationOnly:0,neither:0},
  neitherSucceeds:{both:0,orrOnly:0,confirmationOnly:0,neither:1}
};
const result={
  asOf:AS_OF,methodDate:METHOD_DATE,version:'Joint TILVANCE-301 sensitivity appendix',author:'Kinley Tenzin',
  valuationAsOf:'2026-11-05',archivedVersions:['data/archive/iova-trial-scenarios-2026-11-01.json'],currency:'USD',units:'USD millions except per-share amounts and probabilities',
  assumptionsNote:'Illustrative joint probabilities. Not inferred from response data. All other assumptions are the central model: 30 October 2026 assumptions with the 5 November 2026 cash, share count and price.',
  riskDistributionNote:'Equal marginals give equal expected value in this linear model. No revised Monte Carlo distributions or risk percentiles are calculated.',
  regulatoryNote:'The ORR/frontline event is a modeled program outcome, not an automatic FDA approval. Existing-label withdrawal remains conditional, not certain.',
  scenarios:Object.fromEntries(Object.entries(scenarios).map(([key,probabilities])=>[key,joint301Value(probabilities)]))
};
await mkdir(path.join(root,'data'),{recursive:true});
await writeFile(path.join(root,'data','iova-trial-scenarios.json'),JSON.stringify(result,null,2)+'\n');
console.log(`Built joint-outcome sensitivity on 5 November inputs: reference $${result.scenarios.archivedCoupling.perShare.toFixed(2)}/share.`);
