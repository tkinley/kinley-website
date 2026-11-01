"""
IOVA: Kinley Tenzin's personal valuation case, 30 October 2026.
Web edition of the supplied v2 model. All financial amounts are USD millions;
shares are millions. Requires Python 3.10+ and NumPy (tested with NumPy 1.24.2).
Run: python iova_rnpv_model.py

Assumptions express the author's opinion, not company guidance or probabilities
estimated from clinical response rates. Annual cash flows 2027-2045; mid-year
discounting to approximately end-2026; no terminal value. The 475M diluted shares,
$240M net cash and $8.48 reference price are dated model inputs, not live data.

This web edition preserves v2 valuation arithmetic, renames allegation-based
stress labels as hypothetical adverse-safety scenarios, and removes a cross-trial
death-rate extrapolation. Neither the model nor a missing AE table establishes
concealment or misconduct. Monte Carlo percentages describe chosen assumptions,
not objective probabilities of a future market price. The rho input is a latent
normal-factor correlation, not the realized correlation of binary approvals.

Margins proxy cash generation; capex, working capital, financing and the use of
restricted cash require further work. Tax and development-cost timing are
simplified. Re-check the balance sheet and capital structure with each report.
Personal analysis, not investment advice.
"""
import copy
from statistics import NormalDist
import numpy as np

# ---------------- DATED REFERENCE INPUTS ----------------
SHARES_JUN26 = 452.97                 # M basic shares, 30 Jun 2026 (10-Q)
PX = {"28 Oct": 14.81, "29 Oct": 9.56, "30 Oct": 8.48}

# ---------------- FIXED ASSUMPTIONS ----------------
R, TAX, TAX_START = 0.10, 0.21, 2033
NET_CASH, SH_DIL, CORP_COST = 240.0, 475.0, 40.0
LOSS_IF_WITSAFETYRAWN = 0.70
YEARS = list(range(2027, 2046))
FRONT, NSCLC, SARC, ENDO = ("Frontline melanoma (TILVANCE-301)", "2L NSCLC",
                            "Sarcoma (SARATOGA)", "Endometrial")
CORE_KEY, HC_KEY = "Core melanoma franchise", "Accelerated-approval risk"


def disc(y, r=R):
    return 1.0 / (1 + r) ** (y - 2027 + 0.5)


def after_tax(cf, y):
    return cf * (1 - TAX) if (y >= TAX_START and cf > 0) else cf


def path(points, plateau_end, decline):
    rev, last = {}, max(points)
    for y in YEARS:
        if y in points:
            rev[y] = points[y]
        elif y <= plateau_end:
            rev[y] = points[last]
        else:
            rev[y] = rev[y - 1] * (1 - decline)
    return rev


MARGINS = {"bear": ({2027: .22, 2028: .27, 2029: .31}, .35),
           "base": ({2027: .30, 2028: .37, 2029: .42}, .45),
           "bull": ({2027: .33, 2028: .40, 2029: .46}, .50)}


def margins(k, shift=0.0):
    pts, mature = MARGINS[k]
    return {y: pts.get(y, mature) + shift for y in YEARS}


def core_paths(a):
    e = a["erosion"]
    return {"bear": path({2027: 520, 2028: 580, 2029: 620, 2030: 650}, 2033, e["bear"]),
            "base": path({2027: a["base_2027"], 2028: 760, 2029: 880, 2030: 960, 2031: 1000}, 2035, e["base"]),
            "bull": path({2027: 650, 2028: 900, 2029: 1100, 2030: 1250, 2031: 1400}, 2036, e["bull"])}


def pv(rev, mar, r=R):
    return sum(after_tax(rev[y] * mar[y], y) * disc(y, r) for y in YEARS)


def program(p, r=R):
    """(rNPV, unrisked commercial PV, PV of development cost)"""
    L, peak, m = p["launch"], p["peak"], p["margin"]
    rev, mar = {}, {}
    for y in YEARS:
        k = y - L
        if k < 0:
            rev[y] = 0.0
        elif k < 5:
            rev[y] = peak * (k + 1) / 5
        elif y <= 2038:
            rev[y] = peak
        else:
            rev[y] = rev[y - 1] * 0.92
        mar[y] = 0.0 if k < 0 else min(m, 0.15 + (m - 0.15) * k / 3)
    commercial = pv(rev, mar, r)
    dev = sum(after_tax(-c, y) * disc(y, r) for y, c in p["dev"].items())
    return p["pos"] * commercial + dev, commercial, dev


def corp_pv(r=R):
    return sum(-CORP_COST * disc(y, r) for y in YEARS)


def value(a, r=R, detail=False):
    paths = core_paths(a)
    cp = {k: pv(paths[k], margins(k, a.get("margin_shift", 0.0)), r) for k in paths}
    core = sum(a["weights"][k] * cp[k] for k in cp) * a.get("core_mult", 1.0)
    hc = (1 - a["pipe"][FRONT]["pos"]) * a["p_withdraw"] * LOSS_IF_WITSAFETYRAWN
    parts = {CORE_KEY: core, HC_KEY: -hc * core}
    parts.update({k: program(v, r)[0] for k, v in a["pipe"].items()})
    parts["Next-gen option"] = a["nextgen"]
    parts["One-time costs (legal, remediation)"] = -a.get("one_time", 0.0)
    parts["Corporate"] = corp_pv(r)
    parts["Net cash"] = NET_CASH
    eq = sum(parts.values())
    return (eq, parts, cp) if detail else eq


def ps(x):
    return x / SH_DIL


# ---------------- v1 (yesterday's) assumptions ----------------
V1 = dict(weights=dict(bear=.30, base=.50, bull=.20),
          erosion=dict(bear=.10, base=.08, bull=.06),
          base_2027=600, p_withdraw=.15, nextgen=150.0,
          pipe={FRONT: dict(pos=.50, launch=2029, peak=700, margin=.45, dev={2027: 70, 2028: 70, 2029: 30}),
                NSCLC: dict(pos=.45, launch=2029, peak=500, margin=.40, dev={2027: 35, 2028: 35, 2029: 15}),
                SARC: dict(pos=.25, launch=2029, peak=250, margin=.40, dev={2027: 20, 2028: 20, 2029: 10}),
                ENDO: dict(pos=.20, launch=2029, peak=150, margin=.40, dev={2027: 10, 2028: 10})})


# ---------------- Bridge: author judgment updates -> v2 ----------------
def s1(a):  # lung: durability, LD-regimen confound, no AE table, slow enrollment, label-rate deaths
    a["pipe"][NSCLC] = dict(pos=.30, launch=2030, peak=350, margin=.40, dev={2027: 40, 2028: 40, 2029: 25})


def s2(a):  # competitive-pressure judgment, not a forecast of competitor approval
    a["weights"] = dict(bear=.40, base=.45, bull=.15)


def s3(a):  # judgment: faster revenue erosion in the 2030s
    a["erosion"] = dict(bear=.12, base=.10, bull=.08)


def s4(a):  # guidance math: H2 2026 ~$122M/qtr, QoQ growth slowing
    a["base_2027"] = 575


def s5(a):  # alternatives now exist in 2L melanoma, weaker unmet-need shield for the AA label
    a["p_withdraw"] = .20


def s6(a):  # melanoma-to-other-tumor prior + lung durability on reduced LD
    a["pipe"][SARC]["pos"], a["pipe"][ENDO]["pos"], a["nextgen"] = .20, .15, 100.0


STEPS = [("1. Lung judgment: PoS 45->30%, peak $500->350M, launch 2029->2030, more dev cost", s1),
         ("2. Competition judgment: core weights 30/50/20 -> 40/45/15", s2),
         ("3. Long-run competition judgment: post-peak erosion +2 pts/yr", s3),
         ("4. Guidance deceleration: base 2027 $600M -> $575M", s4),
         ("5. Conditional label-risk judgment: P(label pulled | 301 fails) 15% -> 20%", s5),
         ("6. Platform read-through: sarcoma 25->20%, endometrial 20->15%, next-gen $150->100M", s6)]

print("=== Bridge from v1 to v2 ($/diluted share) ===")
a = copy.deepcopy(V1)
prev = value(a)
print(f"{'v1 (yesterday)':78s} ${ps(prev):5.2f}")
for label, fn in STEPS:
    fn(a)
    v = value(a)
    print(f"{label:78s} {ps(v - prev):+5.2f}  -> ${ps(v):5.2f}")
    prev = v
V2 = copy.deepcopy(a)

eq2, parts2, cp2 = value(V2, detail=True)
print("\n=== v2 sum of the parts ===")
for k, v in parts2.items():
    print(f"{k:42s} {v:7.0f}  ${ps(v):6.2f}/sh")
print(f"{'EQUITY':42s} {eq2:7.0f}  ${ps(eq2):6.2f}/sh (basic ${eq2 / SHARES_JUN26:.2f})")
rest2 = eq2 - parts2[CORE_KEY] - parts2[HC_KEY]
hc2 = -parts2[HC_KEY] / parts2[CORE_KEY]
for k in cp2:
    print(f"  if the {k} core path is the truth: ${ps(cp2[k] * (1 - hc2) + rest2):.2f}/sh")


# ---------------- Scenarios layered on v2 ----------------
def adverse_safety_scenario(a):
    b = copy.deepcopy(a)
    b["pipe"][NSCLC] = dict(pos=0.0, launch=2030, peak=0, margin=.40, dev={2027: 15})  # program wound down
    b["pipe"][SARC]["pos"] *= 0.5        # same LD regimen, more FDA scrutiny
    b["pipe"][ENDO]["pos"] *= 0.5
    b["nextgen"] = 50.0
    b["one_time"] = 100.0                # securities litigation net of insurance, remediation
    b["core_mult"] = 0.95                # referral hesitancy, management distraction
    return b


SAFETY = adverse_safety_scenario(V2)
DOWNSIDE = copy.deepcopy(SAFETY)
DOWNSIDE["weights"] = dict(bear=1.0, base=0.0, bull=0.0)
OPTIMISTIC = copy.deepcopy(V2)
OPTIMISTIC["weights"] = dict(bear=.25, base=.50, bull=.25)
OPTIMISTIC["p_withdraw"] = .15
OPTIMISTIC["pipe"][FRONT]["pos"] = .60
OPTIMISTIC["pipe"][NSCLC] = dict(pos=.45, launch=2029, peak=600, margin=.40, dev={2027: 40, 2028: 40, 2029: 20})
OPTIMISTIC["pipe"][SARC]["pos"], OPTIMISTIC["pipe"][ENDO]["pos"], OPTIMISTIC["nextgen"] = .25, .20, 150.0

v_hd = value(SAFETY)
print("\n=== Scenarios ($/diluted share) ===")
print(f"v2 central assumptions:                         ${ps(eq2):.2f}")
print(f"Hypothetical adverse safety (wind-down, platform, costs): ${ps(v_hd):.2f}  (cost {ps(v_hd - eq2):+.2f})")
for p in (0.05, 0.10, 0.20):
    print(f"  probability-weighted at P={p:.0%}:                   ${ps((1 - p) * eq2 + p * v_hd):.2f}")
print(f"Combined downside (bear core + adverse safety):  ${ps(value(DOWNSIDE)):.2f}")
print(f"Optimistic assumptions (25/50/25 core, 301 PoS 60%, lung 45%):  ${ps(value(OPTIMISTIC)):.2f}")
for k in ("28 Oct", "29 Oct", "30 Oct"):
    print(f"  price {k}: ${PX[k]:.2f}")

print("\n=== Sensitivities around v2 ($/sh) ===")
for r in (0.08, 0.12):
    print(f"discount rate {r:.0%}: ${ps(value(V2, r=r)):.2f}")
for p in (.35, .65):
    b = copy.deepcopy(V2); b["pipe"][FRONT]["pos"] = p
    print(f"TILVANCE-301 PoS {p:.0%}: ${ps(value(b)):.2f}")
b = copy.deepcopy(V2); b["pipe"][NSCLC]["pos"] = 0.0; b["pipe"][NSCLC]["dev"] = {2027: 15}
print(f"Lung worth zero (wind-down): ${ps(value(b)):.2f}")


# ---------------- Reverse DCF at the new price ----------------
def core_single(P, a):
    pts = {2027: float(a["base_2027"])}
    for i, y in enumerate(range(2028, 2032), 1):
        pts[y] = a["base_2027"] + (P - a["base_2027"]) * i / 4
    return path(pts, 2035, a["erosion"]["base"])


def value_single(P, a, r=R):
    e, prts, _ = value(a, r=r, detail=True)
    rest = e - prts[CORE_KEY] - prts[HC_KEY]
    hc = (1 - a["pipe"][FRONT]["pos"]) * a["p_withdraw"] * LOSS_IF_WITSAFETYRAWN
    mar = margins("base", a.get("margin_shift", 0.0))
    return pv(core_single(P, a), mar, r) * a.get("core_mult", 1.0) * (1 - hc) + rest


def solve_peak(px, a):
    lo, hi = 50.0, 20000.0
    for _ in range(100):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if ps(value_single(mid, a)) < px else (lo, mid)
    return mid


print("\n=== Reverse DCF: core peak (2031) the price requires, v2 pipeline ===")
for label, px, a_ in [("v2 itself", ps(eq2), V2), ("$8.48 (30 Oct)", PX["30 Oct"], V2),
                      ("$9.56 (29 Oct)", PX["29 Oct"], V2), ("$8.48 under adverse safety", PX["30 Oct"], SAFETY)]:
    P = solve_peak(px, a_)
    print(f"{label:32s} px ${px:5.2f}: peak ${P:5.0f}M (~{0.84 * P / 0.575:4.0f} infusions/yr)")
print(f"Test of 'overvalued even at $1B sales': single path peaking at $1.0B -> ${ps(value_single(1000, V2)):.2f}/sh")
V2_FRIENDLY = copy.deepcopy(V2); V2_FRIENDLY["margin_shift"] = 0.05
print(f"  same $1.0B peak at 8% and margins +5 pts -> ${ps(value_single(1000, V2_FRIENDLY, r=0.08)):.2f}/sh")
OPTIMISTIC_FRIENDLY = copy.deepcopy(OPTIMISTIC); OPTIMISTIC_FRIENDLY["margin_shift"] = 0.05
print(f"Optimistic assumptions at 8% and margins +5 pts -> ${ps(value(OPTIMISTIC_FRIENDLY, r=0.08)):.2f}/sh")
print(f"Optimistic assumptions at 9% -> ${ps(value(OPTIMISTIC, r=0.09)):.2f}/sh; at 8% -> ${ps(value(OPTIMISTIC, r=0.08)):.2f}/sh")

# ---------------- Monte Carlo on v2 ----------------
print("\n=== Monte Carlo on v2 (200k draws) ===")
nd = NormalDist()
core_exp2 = parts2[CORE_KEY]
base_core2 = cp2["base"]
base_rev2 = core_paths(V2)["base"]
pv_rev2 = sum(base_rev2[y] * ((1 - TAX) if y >= TAX_START else 1.0) * disc(y) for y in YEARS)


def mc(a, rho, n=200_000, seed=11):
    rng = np.random.default_rng(seed)
    sd = 0.32
    mult = np.exp(rng.normal(np.log(core_exp2 / base_core2) - sd ** 2 / 2, sd, n))
    core = mult * (base_core2 + rng.normal(0, .05, n) * pv_rev2)
    common = rng.normal(size=n)
    succ = {}
    for k, p in a["pipe"].items():
        z = np.sqrt(rho) * common + np.sqrt(1 - rho) * rng.normal(size=n)
        succ[k] = z < nd.inv_cdf(min(max(p["pos"], 1e-9), 1 - 1e-9))
    withdraw = (~succ[FRONT]) & (rng.random(n) < a["p_withdraw"])
    tot = np.where(withdraw, core * (1 - LOSS_IF_WITSAFETYRAWN), core)
    for k, p in a["pipe"].items():
        _, cu, d = program({**p, "peak": 1.0})
        s = 0.5 if k == FRONT else 0.6
        pk = np.exp(rng.normal(np.log(max(p["peak"], 1e-9)) - s ** 2 / 2, s, n))
        tot = tot + np.where(succ[k], cu * pk, 0.0) + d
    return (tot + a["nextgen"] + corp_pv() + NET_CASH) / SH_DIL


for rho in (0.0, 0.5):
    v = mc(V2, rho)
    print(f"correlation {rho}: mean ${v.mean():.2f}, median ${np.median(v):.2f}, P10 ${np.percentile(v, 10):.2f}, "
          f"P90 ${np.percentile(v, 90):.2f}, draws > $8.48: {(v > PX['30 Oct']).mean():.0%}")


print("Reference price $8.48 is a dated author input, not a current quote.")
