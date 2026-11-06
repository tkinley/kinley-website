"""Joint TILVANCE-301 sensitivity appendix, written 1 November 2026 and recalculated
on 5 November 2026 with the Q3 cash, share count and price in iova_rnpv_model.py.

Keeps the central model cash flows and changes only the
frontline success marginal and confirmatory-failure marginal. Four probabilities
are assumptions, not estimates derived from clinical response data. This is an
expected-value sensitivity; it does not calculate a revised risk distribution.

Run: python iova_trial_scenarios.py
Or supply a JSON object: python iova_trial_scenarios.py --probabilities '{...}'
Requires the original iova_rnpv_model.py alongside this file and NumPy.
"""
import argparse
import contextlib
import copy
import io
import json
import math
from pathlib import Path
import runpy

KEYS = ("both", "orrOnly", "confirmationOnly", "neither")
COUPLED_REFERENCE = dict(both=.5, orrOnly=0., confirmationOnly=0., neither=.5)
INDEPENDENT_ILLUSTRATION = dict.fromkeys(KEYS, .25)
LOSS_IF_WITHDRAWN = .70
_ARCHIVED = None


def archived_model():
    """Load the companion from this directory; suppress its report on import."""
    global _ARCHIVED
    if _ARCHIVED is None:
        # The archived script has top-level reports and its original simulation.
        # They remain untouched and their stdout is not mixed into this JSON API.
        with contextlib.redirect_stdout(io.StringIO()):
            _ARCHIVED = runpy.run_path(str(Path(__file__).with_name("iova_rnpv_model.py")))
    return _ARCHIVED


def validate_joint_probabilities(probabilities):
    if not isinstance(probabilities, dict) or set(probabilities) != set(KEYS):
        raise ValueError("Use exactly both, orrOnly, confirmationOnly, and neither.")
    for value in probabilities.values():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
            raise ValueError("Each probability must be finite and between 0 and 1.")
    if not math.isclose(sum(probabilities.values()), 1., rel_tol=0., abs_tol=1e-10):
        raise ValueError("Joint probabilities must total 100%.")
    return dict(probabilities)


def joint301_value(probabilities=None, assumptions=None, rate=.1, shares=None, cash=None):
    joint = validate_joint_probabilities(COUPLED_REFERENCE if probabilities is None else probabilities)
    model = archived_model()
    shares = float(model["SH_DIL"]) if shares is None else shares
    cash = float(model["NET_CASH"]) if cash is None else cash
    if not math.isfinite(rate) or rate <= -1:
        raise ValueError("Discount rate must be finite and greater than -100%.")
    if not math.isfinite(shares) or shares <= 0 or not math.isfinite(cash):
        raise ValueError("Shares must be positive and finite, and cash must be finite.")
    a = copy.deepcopy(model["V2"] if assumptions is None else assumptions)
    if not math.isfinite(a["p_withdraw"]) or not 0 <= a["p_withdraw"] <= 1:
        raise ValueError("Conditional withdrawal probability must be between 0 and 1.")
    archived_equity, original_parts, core_pvs = model["value"](a, r=rate, detail=True)
    mapping = {model["CORE_KEY"]:"core", model["HC_KEY"]:"labelRisk", model["FRONT"]:"frontline",
               model["NSCLC"]:"lung", model["SARC"]:"sarcoma", model["ENDO"]:"endometrial",
               "Next-gen option":"nextgen", "One-time costs (legal, remediation)":"oneTime",
               "Corporate":"corporate", "Net cash":"cash"}
    parts = {mapping[key]: float(value) for key, value in original_parts.items()}
    parts["cash"] = float(cash)
    frontline_success = joint["both"] + joint["orrOnly"]
    confirmation_success = joint["both"] + joint["confirmationOnly"]
    confirmation_failure = joint["orrOnly"] + joint["neither"]
    program = copy.deepcopy(a["pipe"][model["FRONT"]])
    program["pos"] = frontline_success
    parts["frontline"] = float(model["program"](program, r=rate)[0])
    parts["labelRisk"] = -confirmation_failure * a["p_withdraw"] * LOSS_IF_WITHDRAWN * parts["core"]
    equity = sum(parts.values())
    archived_per_share = (archived_equity - model["NET_CASH"] + cash) / shares
    return dict(asOf="2026-11-05", methodDate="2026-11-01", probabilities=joint, frontlineSuccess=frontline_success,
                confirmationSuccess=confirmation_success, confirmationFailure=confirmation_failure,
                conditionalWithdrawal=a["p_withdraw"], lossIfWithdrawn=LOSS_IF_WITHDRAWN,
                equity=equity, perShare=equity/shares, parts=parts,
                corePVs={key:float(value) for key,value in core_pvs.items()},
                archivedPerShare=archived_per_share, differencePerShare=equity/shares-archived_per_share)


def report():
    scenarios = dict(archivedCoupling=COUPLED_REFERENCE, illustrativeIndependence=INDEPENDENT_ILLUSTRATION,
                     orrOnly=dict(both=0,orrOnly=1,confirmationOnly=0,neither=0),
                     confirmationOnly=dict(both=0,orrOnly=0,confirmationOnly=1,neither=0),
                     bothSucceed=dict(both=1,orrOnly=0,confirmationOnly=0,neither=0),
                     neitherSucceeds=dict(both=0,orrOnly=0,confirmationOnly=0,neither=1))
    return dict(asOf="2026-11-05", methodDate="2026-11-01", scenarios={name:joint301_value(p) for name,p in scenarios.items()},
                note="Illustrative assumptions only. Expected values do not describe the full risk distribution.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probabilities", help="JSON object with four joint probabilities summing to 1")
    arguments = parser.parse_args()
    output = joint301_value(json.loads(arguments.probabilities)) if arguments.probabilities else report()
    print(json.dumps(output, indent=2, allow_nan=False))
