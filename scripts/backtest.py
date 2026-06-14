"""
Backtest proposed PAT limits against holdout lots, evaluated against
true_latent_fail ground truth. Reports confusion matrix, catch rate, DPPM,
yield loss, and a comparison against spec-only screening.

Usage:
    python backtest.py
        --data   data/synthetic_test_data.csv
        --limits reports/proposed_limits.csv
        --spec   data/parameter_spec.csv
        [--output-dir reports/]
"""

import argparse
import json
import os
import numpy as np
import pandas as pd


class _JsonEncoder(json.JSONEncoder):
    """Serialise numpy scalar types that the stdlib encoder rejects."""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def _flag_pat(df, limits_df):
    """Return boolean Series: True if part fails any PAT limit."""
    flagged = pd.Series(False, index=df.index)
    for _, lim in limits_df.iterrows():
        param = lim["parameter"]
        lo    = lim["pat_lower"]
        hi    = lim["pat_upper"]
        if pd.notna(lo):
            flagged |= (df[param] < lo)
        if pd.notna(hi):
            flagged |= (df[param] > hi)
    return flagged


def _flag_spec(df, limits_df):
    """Return boolean Series: True if part fails any spec limit."""
    flagged = pd.Series(False, index=df.index)
    for _, lim in limits_df.iterrows():
        param = lim["parameter"]
        lo    = lim["spec_lsl"]
        hi    = lim["spec_usl"]
        if pd.notna(lo):
            flagged |= (df[param] < lo)
        if pd.notna(hi):
            flagged |= (df[param] > hi)
    return flagged


def _confusion(true_fail, flagged):
    tp = int(( true_fail &  flagged).sum())
    fn = int(( true_fail & ~flagged).sum())
    fp = int((~true_fail &  flagged).sum())
    tn = int((~true_fail & ~flagged).sum())
    return tp, fn, fp, tn


def _metrics(tp, fn, fp, tn):
    total_defects = tp + fn
    total_good    = fp + tn
    total_passing = tn + fn  # parts that pass screening (used for DPPM denominator)

    recall    = tp / total_defects if total_defects > 0 else None
    precision = tp / (tp + fp)    if (tp + fp) > 0    else None
    yield_loss = fp / total_good  if total_good > 0    else None
    escape_dppm = (fn / total_passing * 1_000_000) if total_passing > 0 else None
    return dict(
        tp=tp, fn=fn, fp=fp, tn=tn,
        total_defects=total_defects,
        total_good=total_good,
        recall=round(recall,    6) if recall    is not None else None,
        precision=round(precision, 6) if precision is not None else None,
        yield_loss_rate=round(yield_loss, 6) if yield_loss is not None else None,
        escape_dppm=round(escape_dppm, 2) if escape_dppm is not None else None,
    )


def _per_param_catches(df, limits_df, true_fail):
    """Return {param: tp_count} showing which PAT limits caught defects."""
    result = {}
    for _, lim in limits_df.iterrows():
        param   = lim["parameter"]
        lo, hi  = lim["pat_lower"], lim["pat_upper"]
        flagged = pd.Series(False, index=df.index)
        if pd.notna(lo):
            flagged |= (df[param] < lo)
        if pd.notna(hi):
            flagged |= (df[param] > hi)
        result[param] = int((true_fail & flagged).sum())
    return result


def backtest(data_path, limits_path, spec_path, output_dir="reports"):
    df      = pd.read_csv(data_path)
    lim_df  = pd.read_csv(limits_path)
    spec_df = pd.read_csv(spec_path)

    # Merge spec limits into lim_df for spec-only screening
    spec_df["lsl"] = pd.to_numeric(spec_df["lsl"], errors="coerce")
    spec_df["usl"] = pd.to_numeric(spec_df["usl"], errors="coerce")
    lim_with_spec  = lim_df.copy()
    for _, sp in spec_df.iterrows():
        p = sp["parameter"]
        mask = lim_with_spec["parameter"] == p
        lim_with_spec.loc[mask, "spec_lsl"] = None if pd.isna(sp["lsl"]) else float(sp["lsl"])
        lim_with_spec.loc[mask, "spec_usl"] = None if pd.isna(sp["usl"]) else float(sp["usl"])

    # Holdout only
    hold = df[df["lot_role"] == "holdout"].copy()
    if hold.empty:
        raise ValueError("No holdout lots found")

    true_fail = hold["true_latent_fail"].astype(bool)

    # --- PAT screening ---
    pat_flagged  = _flag_pat(hold, lim_with_spec)
    spec_flagged = _flag_spec(hold, lim_with_spec)

    # Overall PAT metrics
    pat_m  = _metrics(*_confusion(true_fail, pat_flagged))
    spec_m = _metrics(*_confusion(true_fail, spec_flagged))

    # Per-parameter catch Pareto
    param_catches = _per_param_catches(hold, lim_with_spec, true_fail)

    # --- Per-lot breakdown (for drift story) ---
    per_lot = []
    for lot_id, lot_df in hold.groupby("lot_id"):
        tf  = lot_df["true_latent_fail"].astype(bool)
        pf  = _flag_pat(lot_df, lim_with_spec)
        tp, fn, fp, tn = _confusion(tf, pf)
        total_good = fp + tn
        yl = fp / total_good if total_good > 0 else None
        per_lot.append({
            "lot_id":          lot_id,
            "n_parts":         len(lot_df),
            "n_defects":       int(tf.sum()),
            "tp":              tp,
            "fn":              fn,
            "fp":              fp,
            "tn":              tn,
            "yield_loss_rate": round(yl, 6) if yl is not None else None,
        })
    per_lot_df = pd.DataFrame(per_lot)

    # Stable vs drifted split: LOT10 is the significantly drifted lot
    drifted_lots = ["LOT10"]
    stable_mask  = ~hold["lot_id"].isin(drifted_lots)
    drifted_mask = hold["lot_id"].isin(drifted_lots)

    if stable_mask.any():
        pf_stable = _flag_pat(hold[stable_mask], lim_with_spec)
        stable_m  = _metrics(*_confusion(true_fail[stable_mask], pf_stable))
    else:
        stable_m = None

    if drifted_mask.any():
        pf_drifted  = _flag_pat(hold[drifted_mask], lim_with_spec)
        drifted_m   = _metrics(*_confusion(true_fail[drifted_mask], pf_drifted))
    else:
        drifted_m = None

    # Normalise lot IDs to Python str for JSON serialisability
    holdout_lot_ids = [str(l) for l in hold["lot_id"].unique()]
    stable_lot_ids  = [str(l) for l in hold["lot_id"].unique() if str(l) not in drifted_lots]
    for rec in per_lot:
        rec["lot_id"] = str(rec["lot_id"])

    results = {
        "pat_overall":          pat_m,
        "spec_only_overall":    spec_m,
        "pat_stable_lots":      stable_m,
        "pat_drifted_lot":      drifted_m,
        "per_lot":              per_lot,
        "param_catch_pareto":   param_catches,
        "n_holdout_parts":      int(len(hold)),
        "holdout_lots":         holdout_lot_ids,
        "stable_lots":          stable_lot_ids,
        "drifted_lots":         drifted_lots,
    }

    os.makedirs(output_dir, exist_ok=True)
    json_path = os.path.join(output_dir, "backtest_results.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2, cls=_JsonEncoder)
    print(f"Backtest results: {json_path}")

    # Summary CSV
    summary_rows = []
    for label, m in [("PAT", pat_m), ("Spec-only", spec_m)]:
        if m:
            summary_rows.append({
                "method":         label,
                "tp":             m["tp"],
                "fn":             m["fn"],
                "fp":             m["fp"],
                "tn":             m["tn"],
                "recall":         m["recall"],
                "precision":      m["precision"],
                "yield_loss_pct": round(100 * m["yield_loss_rate"], 4) if m["yield_loss_rate"] is not None else None,
                "escape_dppm":    m["escape_dppm"],
            })
    summ_path = os.path.join(output_dir, "backtest_summary.csv")
    pd.DataFrame(summary_rows).to_csv(summ_path, index=False)

    per_lot_path = os.path.join(output_dir, "backtest_per_lot.csv")
    per_lot_df.to_csv(per_lot_path, index=False)

    # Console summary
    print("\n=== BACKTEST RESULTS ===")
    print(f"{'Metric':<25} {'PAT':>12} {'Spec-only':>12}")
    print("-" * 52)
    for key, label in [("tp","Caught (TP)"), ("fn","Escape (FN)"),
                       ("fp","Over-kill (FP)"), ("tn","Correct pass (TN)"),
                       ("recall","Recall"), ("precision","Precision"),
                       ("yield_loss_rate","Yield loss rate"), ("escape_dppm","Escape DPPM")]:
        pv = pat_m.get(key)
        sv = spec_m.get(key)
        pv_s = f"{pv:.4f}" if isinstance(pv, float) else str(pv)
        sv_s = f"{sv:.4f}" if isinstance(sv, float) else str(sv)
        print(f"  {label:<23} {pv_s:>12} {sv_s:>12}")

    print(f"\nPer-lot yield loss (PAT):")
    # Cap console output for large datasets
    lot_rows = list(per_lot_df.iterrows())
    show_rows = lot_rows if len(lot_rows) <= 20 else lot_rows[:5] + [None] + lot_rows[-5:]
    for item in show_rows:
        if item is None:
            print(f"  ... ({len(lot_rows) - 10} lots omitted) ...")
            continue
        _, r = item
        yl = r["yield_loss_rate"]
        yl_s = f"{100*yl:.2f}%" if yl is not None else "N/A"
        flag = " ← drift-flagged" if str(r["lot_id"]) in drifted_lots else ""
        print(f"  {r['lot_id']}: {yl_s}{flag}")

    if stable_m:
        print(f"\nStable-lots precision: {stable_m['precision']}")
    print(f"Overall precision:      {pat_m['precision']}")
    print("========================\n")

    return results


def main():
    ap = argparse.ArgumentParser(description="Backtest PAT limits against holdout lots.")
    ap.add_argument("--data",       required=True)
    ap.add_argument("--limits",     required=True)
    ap.add_argument("--spec",       required=True)
    ap.add_argument("--output-dir", default="reports")
    args = ap.parse_args()

    backtest(
        data_path=args.data,
        limits_path=args.limits,
        spec_path=args.spec,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    main()
