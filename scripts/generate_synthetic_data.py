"""
Synthetic parametric test data generator for a TMR current sensor.

Generates 10 lots (LOT01-LOT06 reference, LOT07-LOT10 holdout) with
planted maverick parts (true_latent_fail=1) that pass spec but fail PAT,
and genuine spec failures tracked separately (spec_fail=1).

Usage:
    python generate_synthetic_data.py [--seed 42] [--n-lots 10]
        [--wafers-per-lot 5] [--dies-per-wafer 200]
        [--maverick-frac 0.015] [--spec-fail-frac 0.005]
        [--pat-sigma 6] [--output-dir data/]
"""

import argparse
import os
import sys
import numpy as np
import pandas as pd


PARAMETERS = [
    dict(name="sensitivity_error",         unit="%",     lsl=-2.0,  usl=2.0,   mean=0.0,  sigma=0.40, sided="two"),
    dict(name="offset_voltage",            unit="mV",    lsl=-8.0,  usl=8.0,   mean=0.0,  sigma=1.00, sided="two"),
    dict(name="input_referred_noise",      unit="mARMS", lsl=None,  usl=26.0,  mean=18.0, sigma=1.00, sided="upper"),
    dict(name="quiescent_supply_current",  unit="mA",    lsl=None,  usl=12.0,  mean=9.5,  sigma=0.40, sided="upper"),
    dict(name="bandwidth",                 unit="MHz",   lsl=10.0,  usl=None,  mean=12.5, sigma=0.60, sided="lower"),
    dict(name="response_time",             unit="ns",    lsl=None,  usl=50.0,  mean=40.0, sigma=2.50, sided="upper"),
]

N_LOTS = 10
N_REFERENCE_LOTS = 6
DRIFT_PER_HOLDOUT_LOT_MV = 1.1  # mV per holdout lot (LOT07=+1.1, LOT08=+2.2, ...)

# Maverick injection windows — MUST be between PAT limit and spec limit
# offset_voltage: PAT_upper ≈ 6.0 mV, USL=8.0 → inject from [6.2, 7.8]
MAVERICK_OFFSET_HIGH  = (6.2, 7.8)   # mV  (upper-side)
MAVERICK_OFFSET_LOW   = (-7.8, -6.2) # mV  (lower-side)
# input_referred_noise: PAT_upper ≈ 24.0 mARMS, USL=26.0 → inject from [24.2, 25.8]
MAVERICK_NOISE_HIGH   = (24.2, 25.8) # mARMS

# Spec-failure injection windows (outside spec)
SPEC_FAIL_OFFSET_HIGH = (8.1, 9.5)   # mV — above USL=8.0
SPEC_FAIL_NOISE_HIGH  = (26.2, 28.0) # mARMS — above USL=26.0


def _lot_label(i):
    return f"LOT{i+1:02d}"


def _wafer_label(lot_idx, w_idx):
    return f"W{lot_idx+1:02d}-{w_idx+1:02d}"


def _robust_sigma(values):
    q1, q3 = np.percentile(values, [25, 75])
    iqr = q3 - q1
    return iqr / 1.35


def generate(
    seed=42,
    n_lots=N_LOTS,
    wafers_per_lot=5,
    dies_per_wafer=200,
    maverick_frac=0.015,
    spec_fail_frac=0.005,
    pat_sigma=6.0,
    output_dir="data",
):
    rng = np.random.default_rng(seed)
    os.makedirs(output_dir, exist_ok=True)

    # Write parameter_spec.csv
    spec_rows = []
    for p in PARAMETERS:
        spec_rows.append({
            "parameter": p["name"],
            "unit": p["unit"],
            "lsl": p["lsl"] if p["lsl"] is not None else "",
            "usl": p["usl"] if p["usl"] is not None else "",
            "sided": p["sided"],
        })
    pd.DataFrame(spec_rows).to_csv(os.path.join(output_dir, "parameter_spec.csv"), index=False)

    param_names = [p["name"] for p in PARAMETERS]
    n_reference = N_REFERENCE_LOTS
    n_holdout   = n_lots - n_reference

    rows = []
    part_id = 0

    for lot_i in range(n_lots):
        lot_id   = _lot_label(lot_i)
        lot_role = "reference" if lot_i < n_reference else "holdout"
        holdout_idx = (lot_i - n_reference) if lot_i >= n_reference else None

        for w_i in range(wafers_per_lot):
            wafer_id = _wafer_label(lot_i, w_i)
            # die grid — roughly square root of dies_per_wafer
            grid = int(np.ceil(np.sqrt(dies_per_wafer)))
            for d_i in range(dies_per_wafer):
                die_x = d_i % grid
                die_y = d_i // grid
                row = {
                    "part_id":   part_id,
                    "lot_id":    lot_id,
                    "wafer_id":  wafer_id,
                    "die_x":     die_x,
                    "die_y":     die_y,
                    "lot_role":  lot_role,
                    "true_latent_fail": 0,
                    "spec_fail":        0,
                    "maverick_reason":  "",
                }
                # Draw clean normal values for each parameter
                for p in PARAMETERS:
                    mean = p["mean"]
                    # Apply process drift to offset_voltage in holdout lots
                    if p["name"] == "offset_voltage" and holdout_idx is not None:
                        mean = p["mean"] + (holdout_idx + 1) * DRIFT_PER_HOLDOUT_LOT_MV
                    val = rng.normal(mean, p["sigma"])
                    row[p["name"]] = val
                rows.append(row)
                part_id += 1

    df = pd.DataFrame(rows)
    total_parts = len(df)

    # --- Maverick injection ---
    # Budget: ~1.5% of all parts, split evenly among three maverick types
    n_mavericks = int(round(total_parts * maverick_frac))
    n_per_type  = n_mavericks // 3
    remainder   = n_mavericks - 3 * n_per_type

    available_idx = df.index.tolist()
    rng.shuffle(available_idx)

    def _inject(idxs, param, lo, hi, reason):
        for i in idxs:
            df.at[i, param] = rng.uniform(lo, hi)
            df.at[i, "true_latent_fail"] = 1
            df.at[i, "maverick_reason"]  = reason

    chunk = 0
    _inject(available_idx[chunk : chunk + n_per_type + (1 if remainder > 0 else 0)],
            "offset_voltage", *MAVERICK_OFFSET_HIGH, "offset_voltage_high")
    chunk += n_per_type + (1 if remainder > 0 else 0)

    _inject(available_idx[chunk : chunk + n_per_type + (1 if remainder > 1 else 0)],
            "offset_voltage", *MAVERICK_OFFSET_LOW, "offset_voltage_low")
    chunk += n_per_type + (1 if remainder > 1 else 0)

    _inject(available_idx[chunk : chunk + n_per_type],
            "input_referred_noise", *MAVERICK_NOISE_HIGH, "noise_high")

    # --- Spec-failure injection (spec_fail=1, NOT true_latent_fail) ---
    n_spec_fails = int(round(total_parts * spec_fail_frac))
    # Avoid overwriting mavericks
    non_mav_idx = df[df["true_latent_fail"] == 0].index.tolist()
    rng.shuffle(non_mav_idx)
    half = n_spec_fails // 2

    for i in non_mav_idx[:half]:
        df.at[i, "offset_voltage"] = rng.uniform(*SPEC_FAIL_OFFSET_HIGH)
        df.at[i, "spec_fail"] = 1
    for i in non_mav_idx[half : half + (n_spec_fails - half)]:
        df.at[i, "input_referred_noise"] = rng.uniform(*SPEC_FAIL_NOISE_HIGH)
        df.at[i, "spec_fail"] = 1

    # Reorder columns
    col_order = (
        ["part_id", "lot_id", "wafer_id", "die_x", "die_y", "lot_role"]
        + param_names
        + ["true_latent_fail", "spec_fail", "maverick_reason"]
    )
    df = df[col_order]

    out_path = os.path.join(output_dir, "synthetic_test_data.csv")
    df.to_csv(out_path, index=False)

    # --- Self-verification ---
    print("\n=== GENERATOR SELF-VERIFICATION ===")
    print(f"Total parts:    {total_parts}")
    print(f"Mavericks:      {df['true_latent_fail'].sum()} "
          f"({100*df['true_latent_fail'].mean():.2f}% of all parts)")
    print(f"Spec failures:  {df['spec_fail'].sum()} "
          f"({100*df['spec_fail'].mean():.2f}% of all parts)")

    # Overlap check — must be zero
    overlap = ((df["true_latent_fail"] == 1) & (df["spec_fail"] == 1)).sum()
    assert overlap == 0, f"ERROR: {overlap} parts have BOTH true_latent_fail AND spec_fail — violates design"
    print(f"Overlap (latent & spec_fail): {overlap} ✓")

    # Robust sigma on clean main population (reference lots, no mavericks, no spec fails)
    clean = df[(df["lot_role"] == "reference") &
               (df["true_latent_fail"] == 0) &
               (df["spec_fail"] == 0)]
    print("\nRobust sigma on clean reference population:")

    pat_limits = {}
    for p in PARAMETERS:
        name  = p["name"]
        vals  = clean[name].values
        rsig  = _robust_sigma(vals)
        med   = np.median(vals)
        pat_upper = med + pat_sigma * rsig
        pat_lower = med - pat_sigma * rsig
        pat_limits[name] = (pat_lower, pat_upper)
        print(f"  {name:30s}  median={med:7.3f}  robust_sigma={rsig:.4f}"
              f"  PAT=[{pat_lower:.3f}, {pat_upper:.3f}]"
              + (f"  USL={p['usl']}" if p["usl"] is not None else "")
              + (f"  LSL={p['lsl']}" if p["lsl"] is not None else ""))

    print("\nCatch-zone assertions:")
    for name, reason_key, side, usl, lo, hi in [
        ("offset_voltage",       "offset_voltage_high", "upper", 8.0,  *MAVERICK_OFFSET_HIGH),
        ("offset_voltage",       "offset_voltage_low",  "lower", -8.0, *MAVERICK_OFFSET_LOW),
        ("input_referred_noise", "noise_high",          "upper", 26.0, *MAVERICK_NOISE_HIGH),
    ]:
        pat_lo, pat_hi = pat_limits[name]
        mav_vals = df[df["maverick_reason"] == reason_key][name].values
        if side == "upper":
            ok_zone  = pat_hi < usl
            ok_parts = (mav_vals > pat_hi).all() and (mav_vals < usl).all()
            print(f"  {reason_key}: PAT_upper={pat_hi:.3f} < USL={usl} → {'✓' if ok_zone else '✗ FAIL'}"
                  f"  |  all mavericks in catch zone: {'✓' if ok_parts else '✗ FAIL'}")
            assert ok_zone,  f"PAT_upper {pat_hi:.3f} >= USL {usl} — catch zone missing"
            assert ok_parts, f"Some mavericks outside catch zone for {reason_key}"
        else:
            ok_zone  = pat_lo > usl  # usl used as lsl placeholder here
            ok_parts = (mav_vals < pat_lo).all() and (mav_vals > usl).all()
            print(f"  {reason_key}: PAT_lower={pat_lo:.3f} > LSL={usl} → {'✓' if ok_zone else '✗ FAIL'}"
                  f"  |  all mavericks in catch zone: {'✓' if ok_parts else '✗ FAIL'}")
            assert ok_zone,  f"PAT_lower {pat_lo:.3f} <= LSL {usl} — catch zone missing"
            assert ok_parts, f"Some mavericks outside catch zone for {reason_key}"

    # Reference population check
    ref_lots = df[df["lot_role"] == "reference"]["lot_id"].nunique()
    min_parts_per_ref_lot = df[df["lot_role"] == "reference"].groupby("lot_id").size().min()
    print(f"\nReference population: {ref_lots} lots, min {min_parts_per_ref_lot} parts/lot")
    if ref_lots < 6:
        print("  WARNING: fewer than 6 reference lots — PAT limits are under-sampled")
    if min_parts_per_ref_lot < 30:
        print("  WARNING: fewer than 30 parts/lot in some reference lots")
    else:
        print("  Reference population check: ✓")

    print(f"\nOutput: {out_path}")
    print("===================================\n")

    return df


def main():
    ap = argparse.ArgumentParser(description="Generate synthetic TMR current-sensor parametric test data.")
    ap.add_argument("--seed",            type=int,   default=42)
    ap.add_argument("--n-lots",          type=int,   default=N_LOTS)
    ap.add_argument("--wafers-per-lot",  type=int,   default=5)
    ap.add_argument("--dies-per-wafer",  type=int,   default=200)
    ap.add_argument("--maverick-frac",   type=float, default=0.015)
    ap.add_argument("--spec-fail-frac",  type=float, default=0.005)
    ap.add_argument("--pat-sigma",       type=float, default=6.0,
                    help="N for robust_mean ± N*robust_sigma PAT window (verification only)")
    ap.add_argument("--output-dir",      type=str,   default="data")
    args = ap.parse_args()
    generate(
        seed=args.seed,
        n_lots=args.n_lots,
        wafers_per_lot=args.wafers_per_lot,
        dies_per_wafer=args.dies_per_wafer,
        maverick_frac=args.maverick_frac,
        spec_fail_frac=args.spec_fail_frac,
        pat_sigma=args.pat_sigma,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    main()
