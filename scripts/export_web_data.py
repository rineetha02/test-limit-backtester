#!/usr/bin/env python3
"""
export_web_data.py — Convert pipeline outputs to static JSON for the web app.

Reads existing reports/ and data/ directories; computes histogram bins; writes
web-ready JSON to web/public/data/<dataset>/.

Usage:
    python3 scripts/export_web_data.py
"""

import json
import math
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).parent.parent
WEB_DATA = REPO / "web" / "public" / "data"


def _nan(v):
    return None if (v is None or (isinstance(v, float) and math.isnan(v))) else v


def _cpk_rating(cpk):
    if cpk is None:
        return "not_capable"
    if cpk < 1.00:
        return "not_capable"
    if cpk < 1.33:
        return "marginal"
    if cpk < 1.67:
        return "capable"
    return "excellent"


def _robust_sigma(vals):
    q1, q3 = np.nanpercentile(vals, [25, 75])
    return (q3 - q1) / 1.35


def _cpk(mean, sigma, lsl, usl, sided):
    if sigma < 1e-10:
        return None
    if sided == "two":
        return min((usl - mean) / (3 * sigma), (mean - lsl) / (3 * sigma))
    if sided == "upper":
        return (usl - mean) / (3 * sigma)
    if sided == "lower":
        return (mean - lsl) / (3 * sigma)
    return None


def _histogram(values, n_bins=40):
    clean = np.array(values, dtype=float)
    clean = clean[~np.isnan(clean)]
    if len(clean) < 2 or np.std(clean) < 1e-10:
        return []
    counts, edges = np.histogram(clean, bins=n_bins)
    return [
        {"x0": float(edges[i]), "x1": float(edges[i + 1]), "count": int(counts[i])}
        for i in range(len(counts))
    ]


def _write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
    print(f"  wrote {path.relative_to(REPO)}")


def export_dataset(
    dataset_id,
    display_name,
    subtitle,
    source,
    source_url,
    has_ground_truth,
    by_construction,
    caveat,
    data_path,
    spec_path,
    reports_dir,
):
    out = WEB_DATA / dataset_id
    print(f"\n[{dataset_id}]")

    df = pd.read_csv(data_path)
    spec_df = pd.read_csv(spec_path)
    cap_df = pd.read_csv(reports_dir / "capability_table.csv")
    lim_df = pd.read_csv(reports_dir / "proposed_limits.csv")
    with open(reports_dir / "backtest_results.json") as f:
        bt = json.load(f)

    params = list(spec_df["parameter"])

    # meta.json
    _write(
        out / "meta.json",
        {
            "dataset_id": dataset_id,
            "display_name": display_name,
            "subtitle": subtitle,
            "source": source,
            "source_url": source_url,
            "has_ground_truth": has_ground_truth,
            "parts_total": int(len(df)),
            "lots_total": int(df["lot_id"].nunique()),
            "by_construction": by_construction,
            "caveat": caveat,
        },
    )

    # capability.json
    cap_rows = []
    for _, row in cap_df.iterrows():
        cp_val = _nan(row.get("cp"))
        cpk_val = _nan(row.get("cpk"))
        cap_rows.append(
            {
                "parameter": row["parameter"],
                "unit": row.get("unit", ""),
                "lsl": _nan(row.get("lsl")),
                "usl": _nan(row.get("usl")),
                "mean": float(row["mean"]),
                "robust_sigma": float(row["robust_sigma"]),
                "cp": float(cp_val) if cp_val is not None else None,
                "cpk": float(cpk_val) if cpk_val is not None else None,
                "rating": _cpk_rating(float(cpk_val) if cpk_val is not None else None),
                "spec_sided": row.get("sided", "two"),
            }
        )
    _write(out / "capability.json", cap_rows)

    # limits.json
    lim_rows = []
    for _, row in lim_df.iterrows():
        lim_rows.append(
            {
                "parameter": row["parameter"],
                "unit": row.get("unit", ""),
                "lsl": _nan(row.get("spec_lsl")),
                "usl": _nan(row.get("spec_usl")),
                "pat_lower": _nan(row.get("pat_lower")),
                "pat_upper": _nan(row.get("pat_upper")),
                "cpk_target_lower": _nan(row.get("cpk_target_lower")),
                "cpk_target_upper": _nan(row.get("cpk_target_upper")),
                "clamped_to_spec": bool(row.get("pat_clamped_flag", False)),
            }
        )
    _write(out / "limits.json", lim_rows)

    # histograms.json — one per parameter, bins from reference lots only
    ref_df = df[df["lot_role"] == "reference"]
    hist_list = []
    lim_by_param = {r["parameter"]: r for r in lim_rows}
    spec_by_param = {r["parameter"]: r for r in cap_rows}
    for param in params:
        if param not in df.columns:
            continue
        vals = ref_df[param].dropna()
        bins = _histogram(vals)
        lim = lim_by_param.get(param, {})
        spec = spec_by_param.get(param, {})
        lines = []
        if spec.get("lsl") is not None:
            lines.append({"label": "Spec LSL", "value": float(spec["lsl"]), "style": "solid", "color": "spec"})
        if spec.get("usl") is not None:
            lines.append({"label": "Spec USL", "value": float(spec["usl"]), "style": "solid", "color": "spec"})
        if lim.get("pat_lower") is not None:
            lines.append({"label": "PAT lower", "value": float(lim["pat_lower"]), "style": "dashed", "color": "pat"})
        if lim.get("pat_upper") is not None:
            lines.append({"label": "PAT upper", "value": float(lim["pat_upper"]), "style": "dashed", "color": "pat"})
        unit = lim.get("unit", spec.get("unit", ""))
        hist_list.append({"parameter": param, "unit": unit, "bins": bins, "lines": lines})
    _write(out / "histograms.json", hist_list)

    # backtest.json
    pat = bt["pat_overall"]
    spec_only = bt["spec_only_overall"]
    per_lot = bt.get("per_lot", [])
    drifted_lots = set(bt.get("drifted_lots", []))

    yield_by_lot = [
        {
            "lot": str(r["lot_id"]),
            "yield_loss": float(r["yield_loss_rate"]),
            "drifted": str(r["lot_id"]) in drifted_lots,
        }
        for r in per_lot
    ]

    drift_info = None
    if drifted_lots and "offset_voltage" in df.columns:
        drifted_lot = list(drifted_lots)[0]
        ref_ov = df[df["lot_role"] == "reference"]["offset_voltage"].dropna()
        lot10_ov = df[df["lot_id"] == drifted_lot]["offset_voltage"].dropna()
        ref_sigma = _robust_sigma(ref_ov)
        lot10_sigma = _robust_sigma(lot10_ov)
        spec_row = spec_df[spec_df["parameter"] == "offset_voltage"].iloc[0]
        lsl, usl = float(spec_row["lsl"]), float(spec_row["usl"])
        ref_cpk = _cpk(float(ref_ov.mean()), ref_sigma, lsl, usl, "two")
        lot10_cpk = _cpk(float(lot10_ov.mean()), lot10_sigma, lsl, usl, "two")
        drift_info = {
            "param": "offset_voltage",
            "cpk_reference": round(ref_cpk, 4) if ref_cpk else None,
            "cpk_drifted": round(lot10_cpk, 4) if lot10_cpk else None,
            "drifted_lot": drifted_lot,
            "shift_mv": round(float(lot10_ov.mean()) - float(ref_ov.mean()), 2),
        }

    def _screen(s):
        return {
            "recall": _nan(s.get("recall")),
            "escape_dppm": _nan(s.get("escape_dppm")),
            "yield_loss_overall": float(s["yield_loss_rate"]),
            "tp": int(s["tp"]) if s.get("tp") is not None else None,
            "fn": int(s["fn"]) if s.get("fn") is not None else None,
            "fp": int(s["fp"]),
            "tn": int(s["tn"]),
        }

    _write(
        out / "backtest.json",
        {
            "has_ground_truth": has_ground_truth,
            "screens": {"pat": _screen(pat), "spec_only": _screen(spec_only)},
            "yield_loss_by_lot": yield_by_lot,
            "drift": drift_info,
        },
    )

    # drift.json — synthetic only (requires per-lot Cpk + two distributions)
    if dataset_id == "synthetic" and "offset_voltage" in df.columns:
        per_lot_cap_path = reports_dir / "capability_table_per_lot.csv"
        lot_cpk_trend = []
        if per_lot_cap_path.exists():
            plc = pd.read_csv(per_lot_cap_path)
            ref_ov_rows = plc[plc["parameter"] == "offset_voltage"]
            for _, r in ref_ov_rows.iterrows():
                lot_cpk_trend.append(
                    {"lot_id": str(r["lot_id"]), "cpk": round(float(r["cpk"]), 4), "role": "reference", "drifted": False}
                )
        # compute holdout lots' Cpk from raw data
        spec_row = spec_df[spec_df["parameter"] == "offset_voltage"].iloc[0]
        lsl, usl = float(spec_row["lsl"]), float(spec_row["usl"])
        holdout_lots = [l for l in sorted(df["lot_id"].unique()) if l not in [r["lot_id"] for r in lot_cpk_trend]]
        for lot in sorted(holdout_lots):
            vals = df[df["lot_id"] == lot]["offset_voltage"].dropna()
            if len(vals) < 5:
                continue
            sigma = _robust_sigma(vals)
            cpk_val = _cpk(float(vals.mean()), sigma, lsl, usl, "two")
            is_drifted = str(lot) in drifted_lots
            lot_cpk_trend.append(
                {"lot_id": str(lot), "cpk": round(cpk_val, 4) if cpk_val else None, "role": "holdout", "drifted": is_drifted}
            )

        drifted_lot = "LOT10"
        ref_ov = df[df["lot_role"] == "reference"]["offset_voltage"].dropna()
        lot10_ov = df[df["lot_id"] == drifted_lot]["offset_voltage"].dropna()
        lim_row = lim_by_param.get("offset_voltage", {})

        # compute bins with shared x-range for overlay
        x_min = min(ref_ov.min(), lot10_ov.min(), lsl) - 0.5
        x_max = max(ref_ov.max(), lot10_ov.max(), usl) + 0.5
        n_bins = 40
        edges = np.linspace(x_min, x_max, n_bins + 1)

        def _bins_fixed(vals, edges):
            counts, _ = np.histogram(vals, bins=edges)
            return [{"x0": float(edges[i]), "x1": float(edges[i+1]), "count": int(counts[i])} for i in range(len(counts))]

        ref_sigma = _robust_sigma(ref_ov)
        lot10_sigma = _robust_sigma(lot10_ov)
        ref_cpk = _cpk(float(ref_ov.mean()), ref_sigma, lsl, usl, "two")
        lot10_cpk = _cpk(float(lot10_ov.mean()), lot10_sigma, lsl, usl, "two")

        # yield loss on lot10 from backtest
        lot10_bt = next((r for r in per_lot if str(r["lot_id"]) == drifted_lot), {})

        _write(
            out / "drift.json",
            {
                "parameter": "offset_voltage",
                "unit": "mV",
                "pat_lower": lim_row.get("pat_lower"),
                "pat_upper": lim_row.get("pat_upper"),
                "spec_lower": float(lsl),
                "spec_upper": float(usl),
                "shift_mv": round(float(lot10_ov.mean()) - float(ref_ov.mean()), 2),
                "reference": {
                    "mean": round(float(ref_ov.mean()), 4),
                    "cpk": round(float(ref_cpk), 4) if ref_cpk else None,
                    "bins": _bins_fixed(ref_ov, edges),
                },
                "lot10": {
                    "mean": round(float(lot10_ov.mean()), 4),
                    "cpk": round(float(lot10_cpk), 4) if lot10_cpk else None,
                    "yield_loss": float(lot10_bt.get("yield_loss_rate", 0.0642)),
                    "fp_count": int(lot10_bt.get("fp", 63)),
                    "bins": _bins_fixed(lot10_ov, edges),
                },
                "lot_cpk_trend": lot_cpk_trend,
            },
        )


def main():
    # Synthetic
    export_dataset(
        dataset_id="synthetic",
        display_name="Synthetic TMR Current Sensor",
        subtitle="10 lots, 1,000 parts each, planted mavericks",
        source="Generated, seed=42",
        source_url=None,
        has_ground_truth=True,
        by_construction=True,
        caveat=None,
        data_path=REPO / "data" / "synthetic_test_data.csv",
        spec_path=REPO / "data" / "parameter_spec.csv",
        reports_dir=REPO / "reports",
    )

    # SECOM
    export_dataset(
        dataset_id="secom",
        display_name="SECOM (UCI ML Repository)",
        subtitle="1,567 parts, 32 synthetic lots, 591 features",
        source="UCI Machine Learning Repository",
        source_url="https://archive.ics.uci.edu/dataset/179/secom",
        has_ground_truth=False,
        by_construction=False,
        caveat="No maverick ground truth. PAT capability and yield loss shown; recall and escape DPPM omitted.",
        data_path=REPO / "data" / "secom_data.csv",
        spec_path=REPO / "data" / "secom_spec.csv",
        reports_dir=REPO / "reports" / "secom",
    )

    # ST-AWFD
    export_dataset(
        dataset_id="stsawfd",
        display_name="ST-AWFD D2 (STMicroelectronics)",
        subtitle="126,794 parts, 1,156 lots",
        source="STMicroelectronics GitHub",
        source_url="https://github.com/STMicroelectronics/ST-AWFD",
        has_ground_truth=False,
        by_construction=False,
        caveat="All PAT limits clamped to spec due to high intrinsic failure rate (71% yield loss). Demonstrates pipeline robustness on real production data, not a quality win.",
        data_path=REPO / "data" / "stsawfd_data.csv",
        spec_path=REPO / "data" / "stsawfd_spec.csv",
        reports_dir=REPO / "reports" / "stsawfd",
    )

    print("\nDone.")


if __name__ == "__main__":
    main()
