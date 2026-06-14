"""
Adapter: SECOM semiconductor manufacturing dataset → test-limit-backtester schema.

Downloads the SECOM dataset (1,567 parts × 591 features) from the UCI ML Repository,
selects 6 representative parameters, synthesises lot/wafer structure, derives spec
limits from the reference population, and writes the tool's CSV schema.

No ground-truth latent-defect labels are available in SECOM; true_latent_fail is set
to 0 for all parts. The SECOM binary label (pass=1 / fail=-1) is mapped to spec_fail.

Usage:
    python scripts/adapt_secom.py [--output-dir data/] [--n-features 6]
                                   [--parts-per-lot 50] [--sigma-spec 4.0]

Outputs:
    data/secom_data.csv
    data/secom_spec.csv
"""

import argparse
import os
import sys
import warnings
import numpy as np
import pandas as pd


SECOM_DATA_URL   = "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom.data"
SECOM_LABELS_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom_labels.data"

MAX_NAN_FRAC     = 0.50   # drop columns with > 50% NaN
MAX_CORR         = 0.80   # drop one of a pair if abs(corr) > this


def _download_secom():
    """Return (features_df, labels_series) by downloading from UCI."""
    print("Downloading SECOM data from UCI ML Repository...")
    try:
        feat = pd.read_csv(SECOM_DATA_URL,   sep=" ", header=None)
        lab  = pd.read_csv(SECOM_LABELS_URL, sep=" ", header=None, usecols=[0], names=["label"])
        print(f"  Downloaded: {feat.shape[0]} rows × {feat.shape[1]} features")
        return feat, lab["label"]
    except Exception as e:
        sys.exit(f"ERROR: Could not download SECOM dataset: {e}\n"
                 f"  Try: pip install ucimlrepo  and re-run, or check network access.")


def _select_features(df, n_features, rng):
    """Select n_features columns: high variance, low mutual correlation, <50% NaN."""
    # Drop high-NaN columns
    nan_frac = df.isna().mean()
    df = df.loc[:, nan_frac <= MAX_NAN_FRAC].copy()
    print(f"  After dropping high-NaN columns: {df.shape[1]} remaining")

    # Fill remaining NaN with column median
    df = df.fillna(df.median())

    # Drop constant columns
    df = df.loc[:, df.std() > 0]
    print(f"  After dropping constant columns: {df.shape[1]} remaining")

    # Rank by variance (descending) and greedily pick low-correlation candidates
    ranked = df.std().sort_values(ascending=False)
    selected = []
    for col in ranked.index:
        if len(selected) >= n_features:
            break
        if not selected:
            selected.append(col)
            continue
        sub = df[selected + [col]]
        corr_mat = sub.corr().abs()
        # Check that new column is not highly correlated with any already selected
        new_corrs = corr_mat[col].drop(col)
        if new_corrs.max() < MAX_CORR:
            selected.append(col)

    if len(selected) < n_features:
        print(f"  WARNING: Could only select {len(selected)} low-correlation features "
              f"(requested {n_features})")

    print(f"  Selected features (by column index): {selected}")
    result = df[selected].copy()
    # Rename to clean parameter names
    result.columns = [f"param_{int(c):03d}" for c in selected]
    return result, df


def adapt(output_dir="data", n_features=6, parts_per_lot=50, sigma_spec=4.0):
    os.makedirs(output_dir, exist_ok=True)

    feat_raw, labels = _download_secom()
    feat, _ = _select_features(feat_raw, n_features, rng=np.random.default_rng(42))

    n_parts = len(feat)
    param_names = list(feat.columns)

    # --- Synthesise lot / wafer / die structure ---
    n_lots = max(4, n_parts // parts_per_lot)
    lot_ids   = [f"LOT{(i // parts_per_lot) + 1:03d}" for i in range(n_parts)]
    # Pad last lot if it's short
    wafers_per_lot = 5
    parts_per_wafer = max(1, parts_per_lot // wafers_per_lot)
    grid = max(1, int(np.ceil(np.sqrt(parts_per_wafer))))

    rows = []
    for idx, (feat_row, label) in enumerate(zip(feat.itertuples(index=False), labels)):
        lot_num   = idx // parts_per_lot
        lot_id    = f"LOT{lot_num + 1:03d}"
        within    = idx % parts_per_lot
        wafer_num = within // parts_per_wafer
        die_idx   = within % parts_per_wafer
        wafer_id  = f"{lot_id}-W{wafer_num + 1:02d}"
        die_x     = die_idx % grid
        die_y     = die_idx // grid
        row = {
            "part_id":          idx,
            "lot_id":           lot_id,
            "wafer_id":         wafer_id,
            "die_x":            die_x,
            "die_y":            die_y,
            "lot_role":         "",           # filled below
            "true_latent_fail": 0,            # no ground truth in SECOM
            # SECOM convention: 1 = failure (anomaly), -1 = normal (pass)
            "spec_fail":        1 if label == 1 else 0,
            "maverick_reason":  "",
        }
        for col, val in zip(param_names, feat_row):
            row[col] = val
        rows.append(row)

    df = pd.DataFrame(rows)

    # Split lots: first 60% reference, remaining holdout (minimum 2 holdout lots)
    unique_lots = sorted(df["lot_id"].unique())
    n_ref = max(2, int(round(0.60 * len(unique_lots))))
    n_ref = min(n_ref, len(unique_lots) - 2)  # keep at least 2 holdout
    ref_lots  = set(unique_lots[:n_ref])
    hold_lots = set(unique_lots[n_ref:])
    df["lot_role"] = df["lot_id"].apply(lambda x: "reference" if x in ref_lots else "holdout")

    print(f"\nLot structure:")
    print(f"  Total parts: {len(df)}, Lots: {len(unique_lots)}")
    print(f"  Reference: {n_ref} lots, Holdout: {len(unique_lots) - n_ref} lots")
    print(f"  Spec failures: {df['spec_fail'].sum()} "
          f"({100*df['spec_fail'].mean():.1f}%)")

    # --- Derive spec limits from reference population ---
    ref_df = df[df["lot_role"] == "reference"]
    spec_rows = []
    for param in param_names:
        vals  = ref_df[param].dropna()
        mean  = vals.mean()
        sigma = vals.std(ddof=1) if len(vals) > 1 else 1.0
        if sigma < 1e-10:
            sigma = 1.0
            warnings.warn(f"{param}: near-zero sigma in reference; using 1.0 for spec limits")
        lsl = mean - sigma_spec * sigma
        usl = mean + sigma_spec * sigma
        spec_rows.append({
            "parameter": param,
            "unit":      "a.u.",   # SECOM is normalized / unitless
            "lsl":       round(lsl, 6),
            "usl":       round(usl, 6),
            "sided":     "two",
        })

    spec_df = pd.DataFrame(spec_rows)

    # Write outputs
    col_order = (
        ["part_id", "lot_id", "wafer_id", "die_x", "die_y", "lot_role"]
        + param_names
        + ["true_latent_fail", "spec_fail", "maverick_reason"]
    )
    data_path = os.path.join(output_dir, "secom_data.csv")
    spec_path = os.path.join(output_dir, "secom_spec.csv")
    df[col_order].to_csv(data_path, index=False)
    spec_df.to_csv(spec_path, index=False)

    print(f"\nSpec limits (derived at ±{sigma_spec}σ from reference mean):")
    for _, r in spec_df.iterrows():
        print(f"  {r['parameter']:15s}: LSL={r['lsl']:.4f}  USL={r['usl']:.4f}")

    print(f"\nOutput: {data_path}")
    print(f"Output: {spec_path}")
    return data_path, spec_path


def main():
    ap = argparse.ArgumentParser(description="Adapt SECOM dataset to test-limit-backtester schema.")
    ap.add_argument("--output-dir",    default="data")
    ap.add_argument("--n-features",    type=int,   default=6)
    ap.add_argument("--parts-per-lot", type=int,   default=50)
    ap.add_argument("--sigma-spec",    type=float, default=4.0,
                    help="Spec limits set at ±N sigma from reference mean")
    args = ap.parse_args()
    adapt(
        output_dir=args.output_dir,
        n_features=args.n_features,
        parts_per_lot=args.parts_per_lot,
        sigma_spec=args.sigma_spec,
    )


if __name__ == "__main__":
    main()
