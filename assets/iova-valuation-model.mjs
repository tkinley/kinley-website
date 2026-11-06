// Kinley Tenzin's dated v2 assumptions; USD millions, shares in millions.
export const YEARS=Array.from({length:19},(_,i)=>2027+i);
// Capital inputs by version. The 30 October inputs stay here so the archived $5.83 is reproducible.
// 5 November: Q3 10-Q. Cash = $376.320M cash, equivalents and short-term investments at 30 Sep
// (excludes $6.018M restricted; no debt) less one quarter of operating cash use at Q3's rate
// ($137.385M nine-month use − $132.915M first-half use = $4.470M). Shares = 462.655151M outstanding
// on 27 Oct + 29.660828M potentially dilutive securities at 30 Sep (all counted).
export const CAPITAL={
  v2:Object.freeze({asOf:'2026-10-30',shares:475,cash:240,price:8.48,basicJun:452.971}),
  v3:Object.freeze({asOf:'2026-11-05',shares:462.655151+29.660828,cash:371.85,price:7.74,basic:462.655151,dilutive:29.660828})
};
export const SHARES=CAPITAL.v3.shares, CASH=CAPITAL.v3.cash, REFERENCE_PRICE=CAPITAL.v3.price;
export const clone=value=>structuredClone(value);
const marginPoints={bear:[[.22,.27,.31],.35],base:[[.30,.37,.42],.45],bull:[[.33,.40,.46],.50]};
const discount=(y,r)=>1/(1+r)**(y-2027+.5);
const afterTax=(cf,y)=>cf>0&&y>=2033?cf*.79:cf;
export function path(points,plateau,decline){
  const result={},last=Math.max(...Object.keys(points).map(Number));
  for(const y of YEARS)result[y]=points[y]??(y<=plateau?points[last]:result[y-1]*(1-decline));
  return result;
}
export function margins(kind,shift=0){
  const [early,mature]=marginPoints[kind];
  return Object.fromEntries(YEARS.map((y,i)=>[y,(early[i]??mature)+shift]));
}
export function corePaths(a){return {
  bear:path({2027:520,2028:580,2029:620,2030:650},2033,a.erosion.bear),
  base:path({2027:a.base2027,2028:760,2029:880,2030:960,2031:1000},2035,a.erosion.base),
  bull:path({2027:650,2028:900,2029:1100,2030:1250,2031:1400},2036,a.erosion.bull)
};}
const pv=(rev,mar,r)=>YEARS.reduce((sum,y)=>sum+afterTax(rev[y]*mar[y],y)*discount(y,r),0);
export function program(p,r=.10){
  const rev={},mar={};
  for(const y of YEARS){
    const k=y-p.launch;
    rev[y]=k<0?0:k<5?p.peak*(k+1)/5:y<=2038?p.peak:rev[y-1]*.92;
    mar[y]=k<0?0:Math.min(p.margin,.15+(p.margin-.15)*k/3);
  }
  const commercial=pv(rev,mar,r);
  const development=Object.entries(p.dev).reduce((s,[y,c])=>s-c*discount(Number(y),r),0);
  return {commercial,development,rnpv:p.pos*commercial+development};
}
export const V1={weights:{bear:.30,base:.50,bull:.20},erosion:{bear:.10,base:.08,bull:.06},base2027:600,pWithdraw:.15,nextgen:150,pipe:{
  frontline:{pos:.50,launch:2029,peak:700,margin:.45,dev:{2027:70,2028:70,2029:30}},
  lung:{pos:.45,launch:2029,peak:500,margin:.40,dev:{2027:35,2028:35,2029:15}},
  sarcoma:{pos:.25,launch:2029,peak:250,margin:.40,dev:{2027:20,2028:20,2029:10}},
  endometrial:{pos:.20,launch:2029,peak:150,margin:.40,dev:{2027:10,2028:10}}
}};
export const updates=[
  ['Lung: lower probability and sales; later launch',a=>{a.pipe.lung={pos:.30,launch:2030,peak:350,margin:.40,dev:{2027:40,2028:40,2029:25}};}],
  ['Competition: more weight on the bear core path',a=>{a.weights={bear:.40,base:.45,bull:.15};}],
  ['Competition: faster post-peak erosion',a=>{a.erosion={bear:.12,base:.10,bull:.08};}],
  ['2027 base core revenue: $600M → $575M',a=>{a.base2027=575;}],
  ['Conditional label withdrawal: 15% → 20%',a=>{a.pWithdraw=.20;}],
  ['Lower other-pipeline probabilities and option value',a=>{a.pipe.sarcoma.pos=.20;a.pipe.endometrial.pos=.15;a.nextgen=100;}]
];
export const BASE=clone(V1);for(const [,update] of updates)update(BASE);
export function value(a=BASE,r=.10,shares=SHARES,cash=CASH){
  const paths=corePaths(a);
  const corePVs=Object.fromEntries(Object.keys(paths).map(k=>[k,pv(paths[k],margins(k,a.marginShift??0),r)]));
  const core=Object.keys(paths).reduce((s,k)=>s+a.weights[k]*corePVs[k],0)*(a.coreMult??1);
  const parts={core,labelRisk:-(1-a.pipe.frontline.pos)*a.pWithdraw*.70*core};
  for(const [k,p] of Object.entries(a.pipe))parts[k]=program(p,r).rnpv;
  Object.assign(parts,{nextgen:a.nextgen,oneTime:-(a.oneTime??0),corporate:YEARS.reduce((s,y)=>s-40*discount(y,r),0),cash});
  const equity=Object.values(parts).reduce((s,n)=>s+n,0);
  return {equity,perShare:equity/shares,parts,corePVs};
}
export function adverseSafety(a=BASE){
  const b=clone(a);
  b.pipe.lung={pos:0,launch:2030,peak:0,margin:.40,dev:{2027:15}};
  b.pipe.sarcoma.pos*=.5;b.pipe.endometrial.pos*=.5;b.nextgen=50;b.oneTime=100;b.coreMult=.95;
  return b;
}
export function optimistic(a=BASE){
  const b=clone(a);b.weights={bear:.25,base:.50,bull:.25};b.pWithdraw=.15;b.pipe.frontline.pos=.60;
  b.pipe.lung={pos:.45,launch:2029,peak:600,margin:.40,dev:{2027:40,2028:40,2029:20}};
  b.pipe.sarcoma.pos=.25;b.pipe.endometrial.pos=.20;b.nextgen=150;return b;
}
export function singleCoreValue(peak,a=BASE,r=.10,shares=SHARES,cash=CASH){
  const points={2027:a.base2027};
  for(let i=1;i<=4;i++)points[2027+i]=a.base2027+(peak-a.base2027)*i/4;
  const {equity,parts}=value(a,r,shares,cash);
  const core=pv(path(points,2035,a.erosion.base),margins('base',a.marginShift??0),r)*(a.coreMult??1);
  return (core*(1-(1-a.pipe.frontline.pos)*a.pWithdraw*.70)+equity-parts.core-parts.labelRisk)/shares;
}
export function reversePeak(price=REFERENCE_PRICE,a=BASE,r=.10,shares=SHARES,cash=CASH){
  let lo=0,hi=20000;
  if(singleCoreValue(lo,a,r,shares,cash)>price||singleCoreValue(hi,a,r,shares,cash)<price)return null;
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(singleCoreValue(mid,a,r,shares,cash)<price)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
// The 30 October judgment bridge (v1 → v2) is history, so it uses the 30 October capital inputs.
export function bridge(shares=CAPITAL.v2.shares,cash=CAPITAL.v2.cash){
  const a=clone(V1),rows=[{label:'Earlier model (v1)',...value(a,.10,shares,cash),change:0}];
  for(const [label,update] of updates){const prev=rows.at(-1).perShare;update(a);const v=value(a,.10,shares,cash);rows.push({label,...v,change:v.perShare-prev});}
  return rows;
}
// The 5 November update changes capital inputs only. Step 2 keeps v2's implied allowance for
// options and RSUs (475M − 452.971M June basic shares) so new issuance is separated from step 3,
// which is a stricter counting convention, not new information.
export function inputBridge(a=BASE){
  const {v2,v3}=CAPITAL,allowance=v2.shares-v2.basicJun;
  const steps=[
    ['30 October model (v2)',v2.shares,v2.cash],
    ['Net cash: $240M estimate → 30 September balance less one quarter of Q3-rate cash use',v2.shares,v3.cash],
    ['Shares: add shares issued since June (at-the-market sales and vesting), same option and RSU allowance',v3.basic+allowance,v3.cash],
    ['Shares: count every potentially dilutive security (options, RSUs, ESPP, convertible preferred)',v3.shares,v3.cash]
  ];
  let prev=null;
  return steps.map(([label,shares,cash])=>{const v=value(a,.10,shares,cash);const row={label,shares,cash,perShare:v.perShare,change:prev===null?0:v.perShare-prev};prev=v.perShare;return row;});
}
export const PART_LABELS={core:'Core melanoma franchise',labelRisk:'Accelerated-approval risk',frontline:'Frontline melanoma',lung:'Lung cancer',sarcoma:'Sarcoma',endometrial:'Endometrial cancer',nextgen:'Next-generation option',oneTime:'One-time costs',corporate:'Corporate costs',cash:'Assumed net cash'};
