"""
Compute capability statistics (Cp, Cpk, robust stats) for each test parameter.

Usage:
    python profile_tests.py
        --data data/synthetic_test_data.csv
        --spec data/parameter_spec.csv
        [--lots LOT01,LOT02,...]      # default: all reference lots
        [--output reports/capability_table.csv]
        [--per-lot]                   # also write per-lot breakdown
"""

import argparse
import os
import sys
import warnings
import numpy as np
import pandas as pd


def _cpk_rating(cpk):
    if cpk is None or np.isnan(cpk):
        return "unknown"
    if cpk < 1.00:
        return "not_capable"
    if cpk < 1.33:
        return "marginal"
    if cpk < 1.67:
        return "capable"
    return "excellent"


def _robust_sigma(values):
    q1, q3 = np.percentile(values, [25, 75])
    iqr = q3 - q1
    return iqr / 1.35


def _compute_cpk(mean, sigma, lsl, usl, sided):
    if sigma == 0:
        warnings.warn("sigma=0 encountered; Cpk set to inf")
        return np.inf, None
    if sided == "two":
        cpu = (usl - mean) / (3 * sigma)
        cpl = (mean - lsl)  / (3 * sigma)
        return min(cpu, cpl), None
    if sided == "upper":
        return (usl - mean) / (3 * sigma), None
    if sided == "lower":
        return (mean - lsl)  / (3 * sigma), None
    raise ValueError(f"Unknown sided value: {sided}")


def _compute_cp(sigma, lsl, usl, sided):
    if sided != "two":
        return None
    if sigma == 0:
        return np.inf
    return (usl - lsl) / (6 * sigma)


def _spec_pass(series, lsl, usl):
    mask = pd.Series([True] * len(series), index=series.index)
    if lsl is not None and not pd.isna(lsl):
        mask &= (series >= lsl)
    if usl is not None and not pd.isna(usl):
        mask &= (series <= usl)
    return mask


def profile(data_path, spec_path, lots=None, output_path=None, per_lot=False):
    df   = pd.read_csv(data_path)
    spec = pd.read_csv(spec_path)

    # Normalise missing spec limits
    spec["lsl"] = pd.to_numeric(spec["lsl"], errors="coerce")
    spec["usl"] = pd.to_numeric(spec["usl"], errors="coerce")

    # Filter lots
    if lots:
        df = df[df["lot_id"].isin(lots)]
    else:
        df = df[df["lot_role"] == "reference"]

    if df.empty:
        sys.exit("ERROR: no rows match the lot filter")

    records = []
    for _, row in spec.iterrows():
        param  = row["parameter"]
        lsl    = None if pd.isna(row["lsl"]) else float(row["lsl"])
        usl    = None if pd.isna(row["usl"]) else float(row["usl"])
        sided  = row["sided"]
        vals   = df[param].dropna()

        n     = len(vals)
        mean  = vals.mean()
        sigma = vals.std(ddof=1) if n > 1 else 0.0
        med   = vals.median()
        q1, q3 = np.percentile(vals, [25, 75])
        iqr   = q3 - q1
        rsig  = _robust_sigma(vals)
        vmin  = vals.min()
        vmax  = vals.max()

        cpk, _ = _compute_cpk(mean, sigma, lsl, usl, sided)
        cp      = _compute_cp(sigma, lsl, usl, sided)
        rating  = _cpk_rating(cpk)

        pass_mask  = _spec_pass(vals, lsl, usl)
        pass_count = int(pass_mask.sum())
        yield_pct  = 100.0 * pass_count / n if n else 0.0

        records.append({
            "parameter":       param,
            "unit":            row["unit"],
            "sided":           sided,
            "n":               n,
            "mean":            round(mean,  6),
            "sigma":           round(sigma, 6),
            "median":          round(med,   6),
            "q1":              round(q1,    6),
            "q3":              round(q3,    6),
            "iqr":             round(iqr,   6),
            "robust_sigma":    round(rsig,  6),
            "min":             round(vmin,  6),
            "max":             round(vmax,  6),
            "lsl":             lsl,
            "usl":             usl,
            "cp":              round(cp,  4) if cp is not None else None,
            "cpk":             round(cpk, 4),
            "cpk_rating":      rating,
            "spec_pass_count": pass_count,
            "spec_yield_pct":  round(yield_pct, 4),
        })

    result = pd.DataFrame(records)

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        result.to_csv(output_path, index=False)
        print(f"Capability table: {output_path}")

    if per_lot:
        per_lot_records = []
        for lot_id, lot_df in df.groupby("lot_id"):
            for _, row in spec.iterrows():
                param  = row["parameter"]
                lsl    = None if pd.isna(row["lsl"]) else float(row["lsl"])
                usl    = None if pd.isna(row["usl"]) else float(row["usl"])
                sided  = row["sided"]
                vals   = lot_df[param].dropna()
                n      = len(vals)
                if n < 2:
                    continue
                mean  = vals.mean()
                sigma = vals.std(ddof=1)
                cpk, _ = _compute_cpk(mean, sigma, lsl, usl, sided)
                per_lot_records.append({
                    "lot_id":    lot_id,
                    "parameter": param,
                    "n":         n,
                    "mean":      round(mean,  6),
                    "sigma":     round(sigma, 6),
                    "cpk":       round(cpk,   4),
                    "cpk_rating": _cpk_rating(cpk),
                })
        per_lot_df = pd.DataFrame(per_lot_records)
        if output_path:
            per_lot_path = output_path.replace(".csv", "_per_lot.csv")
            per_lot_df.to_csv(per_lot_path, index=False)
            print(f"Per-lot capability: {per_lot_path}")
        return result, per_lot_df

    return result


def main():
    ap = argparse.ArgumentParser(description="Compute Cp/Cpk capability statistics per parameter.")
    ap.add_argument("--data",     required=True, help="Path to synthetic_test_data.csv")
    ap.add_argument("--spec",     required=True, help="Path to parameter_spec.csv")
    ap.add_argument("--lots",     default=None,  help="Comma-separated lot IDs (default: reference lots)")
    ap.add_argument("--output",   default="reports/capability_table.csv")
    ap.add_argument("--per-lot",  action="store_true", help="Also compute per-lot breakdown")
    args = ap.parse_args()

    lots = [x.strip() for x in args.lots.split(",")] if args.lots else None
    result = profile(
        data_path=args.data,
        spec_path=args.spec,
        lots=lots,
        output_path=args.output,
        per_lot=args.per_lot,
    )
    if isinstance(result, tuple):
        cap, _ = result
    else:
        cap = result

    print(cap[["parameter", "mean", "sigma", "cpk", "cpk_rating", "spec_yield_pct"]].to_string(index=False))


if __name__ == "__main__":
    main()
