"""
Propose PAT outlier limits and Cpk-target limits for each test parameter.

PAT limits use AEC-Q001 robust statistics (median ± N * IQR/1.35) derived
from the reference population. Limits are clamped to spec and the flag is set
when clamping occurs.

Usage:
    python propose_limits.py
        --data    data/synthetic_test_data.csv
        --spec    data/parameter_spec.csv
        --profile reports/capability_table.csv
        [--pat-sigma 6]
        [--cpk-target 1.33]
        [--mode static|dynamic]
        [--output reports/proposed_limits.csv]
"""

import argparse
import os
import warnings
import numpy as np
import pandas as pd


MIN_REFERENCE_LOTS    = 6
MIN_PARTS_PER_REF_LOT = 30


def _robust_stats(vals):
    med  = np.median(vals)
    q1, q3 = np.percentile(vals, [25, 75])
    iqr  = q3 - q1
    rsig = iqr / 1.35
    return med, rsig


def _clamp(val, lo, hi):
    """Clamp val to [lo, hi] if bounds exist; return (clamped_val, was_clamped)."""
    clamped = False
    if lo is not None and val is not None and val < lo:
        val = lo
        clamped = True
    if hi is not None and val is not None and val > hi:
        val = hi
        clamped = True
    return val, clamped


def propose(data_path, spec_path, profile_path,
            pat_sigma=6.0, cpk_target=1.33, mode="static",
            output_path=None):

    df      = pd.read_csv(data_path)
    spec_df = pd.read_csv(spec_path)
    prof_df = pd.read_csv(profile_path)

    spec_df["lsl"] = pd.to_numeric(spec_df["lsl"], errors="coerce")
    spec_df["usl"] = pd.to_numeric(spec_df["usl"], errors="coerce")

    ref_df = df[df["lot_role"] == "reference"]

    # Reference population warnings
    ref_lots = ref_df["lot_id"].nunique()
    min_ppl  = ref_df.groupby("lot_id").size().min() if ref_lots > 0 else 0
    if ref_lots < MIN_REFERENCE_LOTS:
        warnings.warn(
            f"Only {ref_lots} reference lots (minimum {MIN_REFERENCE_LOTS}). "
            "PAT limits are under-sampled."
        )
    if min_ppl < MIN_PARTS_PER_REF_LOT:
        warnings.warn(
            f"Some reference lots have <{MIN_PARTS_PER_REF_LOT} parts. "
            "PAT limits may be unreliable."
        )

    records = []
    for _, sp in spec_df.iterrows():
        param = sp["parameter"]
        lsl   = None if pd.isna(sp["lsl"]) else float(sp["lsl"])
        usl   = None if pd.isna(sp["usl"]) else float(sp["usl"])
        sided = sp["sided"]

        ref_vals = ref_df[param].dropna().values

        # --- Static PAT limits ---
        med, rsig = _robust_stats(ref_vals)
        raw_lower = med - pat_sigma * rsig
        raw_upper = med + pat_sigma * rsig

        if sided == "upper":
            pat_lower = None
            raw_lower = None
        elif sided == "lower":
            pat_upper_raw = None
            raw_upper = None

        pat_lower_raw = raw_lower
        pat_upper_raw = raw_upper

        # Clamp to spec
        clamped = False
        if pat_lower_raw is not None and lsl is not None and pat_lower_raw < lsl:
            pat_lower = lsl
            clamped = True
            warnings.warn(f"{param}: PAT lower limit {pat_lower_raw:.4f} < LSL {lsl}; clamped to LSL.")
        else:
            pat_lower = pat_lower_raw

        if pat_upper_raw is not None and usl is not None and pat_upper_raw > usl:
            pat_upper = usl
            clamped = True
            warnings.warn(f"{param}: PAT upper limit {pat_upper_raw:.4f} > USL {usl}; clamped to USL.")
        else:
            pat_upper = pat_upper_raw

        # --- Cpk-target limits (from capability profile) ---
        prof_row = prof_df[prof_df["parameter"] == param]
        if len(prof_row) == 0:
            cpk_lower = cpk_upper = None
        else:
            pr     = prof_row.iloc[0]
            pmean  = float(pr["mean"])
            psigma = float(pr["sigma"])
            margin = 3 * cpk_target * psigma
            cpk_upper = pmean + margin if usl is not None else None
            cpk_lower = pmean - margin if lsl is not None else None

        records.append({
            "parameter":           param,
            "unit":                sp["unit"],
            "sided":               sided,
            "spec_lsl":            lsl,
            "spec_usl":            usl,
            "pat_lower":           round(pat_lower, 4) if pat_lower is not None else None,
            "pat_upper":           round(pat_upper, 4) if pat_upper is not None else None,
            "pat_lower_raw":       round(pat_lower_raw, 4) if pat_lower_raw is not None else None,
            "pat_upper_raw":       round(pat_upper_raw, 4) if pat_upper_raw is not None else None,
            "pat_clamped_flag":    clamped,
            "cpk_target_lower":    round(cpk_lower, 4) if cpk_lower is not None else None,
            "cpk_target_upper":    round(cpk_upper, 4) if cpk_upper is not None else None,
            "pat_sigma":           pat_sigma,
            "cpk_target":          cpk_target,
        })

        if mode == "dynamic":
            print(f"  [DPAT] {param}: median={med:.4f} robust_sigma={rsig:.4f} "
                  f"PAT=[{pat_lower}, {pat_upper}]")

    result = pd.DataFrame(records)

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        result.to_csv(output_path, index=False)
        print(f"Proposed limits: {output_path}")

    print("\nProposed PAT limits (vs spec):")
    for _, r in result.iterrows():
        clamped_note = " [CLAMPED]" if r["pat_clamped_flag"] else ""
        print(f"  {r['parameter']:30s}  "
              f"LSL={str(r['spec_lsl']):>7}  USL={str(r['spec_usl']):>7}  "
              f"PAT=[{str(r['pat_lower']):>8}, {str(r['pat_upper']):>8}]"
              f"{clamped_note}")

    return result


def main():
    ap = argparse.ArgumentParser(description="Propose PAT and Cpk-target test limits.")
    ap.add_argument("--data",       required=True)
    ap.add_argument("--spec",       required=True)
    ap.add_argument("--profile",    required=True)
    ap.add_argument("--pat-sigma",  type=float, default=6.0)
    ap.add_argument("--cpk-target", type=float, default=1.33)
    ap.add_argument("--mode",       choices=["static", "dynamic"], default="static")
    ap.add_argument("--output",     default="reports/proposed_limits.csv")
    args = ap.parse_args()

    propose(
        data_path=args.data,
        spec_path=args.spec,
        profile_path=args.profile,
        pat_sigma=args.pat_sigma,
        cpk_target=args.cpk_target,
        mode=args.mode,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
