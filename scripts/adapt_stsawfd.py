"""
Adapter: STMicroelectronics ST-AWFD Dataset D2 → test-limit-backtester schema.

Downloads D2 from GitHub (126,795 rows, ~1,157 lots, 15-20 normalized parametric columns),
selects 6 informative parameters, splits lots into reference/holdout, derives spec limits
from the reference population, and writes the tool's CSV schema.

No latent-defect ground truth is available; true_latent_fail is set to 0 for all parts.
The ST-AWFD fault label is mapped to spec_fail.

Reference:
  STMicroelectronics ST-AWFD: https://github.com/STMicroelectronics/ST-AWFD

Usage:
    python scripts/adapt_stsawfd.py [--output-dir data/] [--n-features 6]
                                     [--ref-lot-frac 0.60] [--spec-percentile 1.0]
"""

import argparse
import io
import os
import sys
import warnings
import urllib.request
import numpy as np
import pandas as pd


D2_ZIP_URLS = [
    "https://github.com/STMicroelectronics/ST-AWFD/raw/main/Datasets/D2.zip",
    "https://github.com/STMicroelectronics/ST-AWFD/raw/master/Datasets/D2.zip",
    "https://github.com/STMicroelectronics/ST-AWFD/raw/main/datasets/D2.zip",
]

MAX_CORR     = 0.80
MAX_NAN_FRAC = 0.30


def _download_stsawfd():
    import zipfile
    import tempfile

    for url in D2_ZIP_URLS:
        try:
            print(f"  Trying: {url}")
            with urllib.request.urlopen(url, timeout=60) as resp:
                zip_bytes = resp.read()
            print(f"  Downloaded {len(zip_bytes)//1024} KB — extracting...")
            with tempfile.TemporaryDirectory() as tmpdir:
                zip_path = os.path.join(tmpdir, "D2.zip")
                with open(zip_path, "wb") as f:
                    f.write(zip_bytes)
                with zipfile.ZipFile(zip_path, "r") as zf:
                    csv_files = [n for n in zf.namelist() if n.endswith(".csv")]
                    if not csv_files:
                        raise ValueError("No CSV inside zip")
                    csv_name = csv_files[0]
                    print(f"  Extracting: {csv_name}")
                    with zf.open(csv_name) as cf:
                        df = pd.read_csv(cf)
            print(f"  Loaded: {df.shape[0]} rows × {df.shape[1]} columns")
            return df
        except Exception as e:
            print(f"  Failed: {e}")
    sys.exit(
        "ERROR: Could not download ST-AWFD D2. "
        "Download manually from https://github.com/STMicroelectronics/ST-AWFD "
        "(Datasets/D2.zip), extract to data/D2.csv, then re-run with --local-file data/D2.csv"
    )


def _identify_columns(df):
    """Return (lot_col, fault_col, param_cols) by heuristic inspection."""
    cols = list(df.columns)

    # Lot column: contains 'lot', 'material', 'id' in name or is the first column
    lot_col = next(
        (c for c in cols if any(k in c.lower() for k in ("lot", "material", "lotid", "lot_id"))),
        cols[0],
    )

    # Fault/label column: look for common names including 'target'
    fault_col = next(
        (c for c in cols if any(k in c.lower()
                                for k in ("fault", "fail", "label", "class",
                                          "defect", "status", "target", "result"))),
        None,
    )
    # Must be binary (≤2 unique values excl. NaN)
    if fault_col and df[fault_col].nunique(dropna=True) > 2:
        fault_col = None

    # Non-parametric infrastructure columns to always exclude
    infra_keywords = ("step", "duration", "time", "date", "test", "train",
                      "is_test", "split", "index", "id")
    always_exclude = {lot_col} | ({fault_col} if fault_col else set())
    always_exclude |= {c for c in cols if any(k in c.lower() for k in infra_keywords)}

    # Parametric columns: numeric, not excluded, and have enough unique values to be continuous
    param_cols = [
        c for c in cols
        if c not in always_exclude
        and pd.api.types.is_numeric_dtype(df[c])
        and df[c].nunique(dropna=True) >= 10   # exclude binary/quasi-categorical
    ]
    return lot_col, fault_col, param_cols


def _select_features(df, param_cols, n_features):
    sub = df[param_cols].copy()
    # Drop high-NaN
    nan_frac = sub.isna().mean()
    sub = sub.loc[:, nan_frac <= MAX_NAN_FRAC].fillna(sub.median())
    # Drop constant
    sub = sub.loc[:, sub.std() > 0]
    if sub.shape[1] == 0:
        sys.exit("ERROR: No valid parametric columns found after filtering.")

    # Rank by variance across lot means (between-lot variability)
    # This selects features that actually vary between lots (more interesting for PAT)
    lot_means = df.groupby(df.columns[0])[sub.columns].mean()
    between_lot_var = lot_means.std()
    ranked = between_lot_var.sort_values(ascending=False)

    selected = []
    for col in ranked.index:
        if len(selected) >= n_features:
            break
        if not selected:
            selected.append(col)
            continue
        corr_mat = sub[selected + [col]].corr().abs()
        if corr_mat[col].drop(col).max() < MAX_CORR:
            selected.append(col)

    if len(selected) < n_features:
        print(f"  WARNING: Only {len(selected)} low-corr features found (requested {n_features})")
    return selected, sub[selected]


def adapt(
    output_dir="data",
    n_features=6,
    ref_lot_frac=0.60,
    spec_percentile=1.0,
    local_file=None,
):
    os.makedirs(output_dir, exist_ok=True)

    print("Loading ST-AWFD D2 dataset...")
    if local_file and os.path.exists(local_file):
        raw_df = pd.read_csv(local_file)
        print(f"  Loaded local file: {raw_df.shape}")
    else:
        raw_df = _download_stsawfd()

    lot_col, fault_col, param_cols_all = _identify_columns(raw_df)
    print(f"\nIdentified columns:")
    print(f"  Lot column:   {lot_col}")
    print(f"  Fault column: {fault_col}")
    print(f"  Parametric:   {len(param_cols_all)} columns")

    selected_cols, feat_df = _select_features(raw_df, param_cols_all, n_features)
    feat_df = feat_df.reset_index(drop=True)
    print(f"  Selected {len(selected_cols)} features: {selected_cols}")

    # Rename to clean names
    rename = {c: f"param_{i+1:02d}" for i, c in enumerate(selected_cols)}
    feat_df = feat_df.rename(columns=rename)
    param_names = list(feat_df.columns)

    # Lot assignments
    lot_series = raw_df[lot_col].astype(str).reset_index(drop=True)
    unique_lots = sorted(lot_series.unique())
    n_ref  = max(2, int(round(ref_lot_frac * len(unique_lots))))
    n_ref  = min(n_ref, len(unique_lots) - 2)
    ref_lots  = set(unique_lots[:n_ref])

    # Fault / spec_fail
    if fault_col is not None:
        fault_series = raw_df[fault_col].reset_index(drop=True)
        # Normalise: if binary 0/1 assume 1=fault; if -1/1 assume -1=normal,1=fault
        unique_fault = fault_series.dropna().unique()
        if set(unique_fault).issubset({-1, 1, -1.0, 1.0}):
            spec_fail_series = (fault_series == 1).astype(int)
        elif set(unique_fault).issubset({0, 1, 0.0, 1.0}):
            spec_fail_series = (fault_series == 1).astype(int)
        else:
            # unknown — treat majority class as pass
            majority = fault_series.value_counts().index[0]
            spec_fail_series = (fault_series != majority).astype(int)
            warnings.warn(f"Ambiguous fault values {unique_fault}; majority {majority} treated as pass")
    else:
        spec_fail_series = pd.Series(0, index=range(len(raw_df)))

    # Synthesise die coordinates per lot
    max_parts_per_lot = lot_series.value_counts().max()
    grid = max(1, int(np.ceil(np.sqrt(max_parts_per_lot))))

    rows = []
    lot_counters = {}
    for idx in range(len(feat_df)):
        lot_id = lot_series.iloc[idx]
        within = lot_counters.get(lot_id, 0)
        lot_counters[lot_id] = within + 1
        wafer_num = within // max(1, max_parts_per_lot // 5)
        die_idx   = within % max(1, max_parts_per_lot // 5)
        row = {
            "part_id":          idx,
            "lot_id":           lot_id,
            "wafer_id":         f"{lot_id}-W{wafer_num+1:02d}",
            "die_x":            die_idx % grid,
            "die_y":            die_idx // grid,
            "lot_role":         "reference" if lot_id in ref_lots else "holdout",
            "true_latent_fail": 0,
            "spec_fail":        int(spec_fail_series.iloc[idx]),
            "maverick_reason":  "",
        }
        for p in param_names:
            row[p] = feat_df[p].iloc[idx]
        rows.append(row)

    df = pd.DataFrame(rows)

    print(f"\nLot structure:")
    print(f"  Total parts:  {len(df)}")
    print(f"  Unique lots:  {len(unique_lots)}")
    print(f"  Reference:    {n_ref} lots")
    print(f"  Holdout:      {len(unique_lots) - n_ref} lots")
    print(f"  Spec fails:   {df['spec_fail'].sum()} ({100*df['spec_fail'].mean():.2f}%)")

    # Derive spec limits from reference population
    ref_df = df[df["lot_role"] == "reference"]
    spec_rows = []
    for p in param_names:
        vals  = ref_df[p].dropna()
        lo    = np.percentile(vals, spec_percentile)
        hi    = np.percentile(vals, 100 - spec_percentile)
        if lo >= hi:
            lo = vals.mean() - 3 * vals.std()
            hi = vals.mean() + 3 * vals.std()
            warnings.warn(f"{p}: percentile-based limits degenerate; using ±3σ")
        spec_rows.append({
            "parameter": p,
            "unit":      "a.u.",
            "lsl":       round(float(lo), 6),
            "usl":       round(float(hi), 6),
            "sided":     "two",
        })

    spec_df = pd.DataFrame(spec_rows)

    print(f"\nSpec limits (from {spec_percentile:.1f}/99.{100-int(spec_percentile)} percentile of reference):")
    for _, r in spec_df.iterrows():
        print(f"  {r['parameter']:12s}: LSL={r['lsl']:.4f}  USL={r['usl']:.4f}")

    col_order = (
        ["part_id", "lot_id", "wafer_id", "die_x", "die_y", "lot_role"]
        + param_names
        + ["true_latent_fail", "spec_fail", "maverick_reason"]
    )
    data_path = os.path.join(output_dir, "stsawfd_data.csv")
    spec_path = os.path.join(output_dir, "stsawfd_spec.csv")
    df[col_order].to_csv(data_path, index=False)
    spec_df.to_csv(spec_path, index=False)

    print(f"\nOutput: {data_path}")
    print(f"Output: {spec_path}")
    return data_path, spec_path


def main():
    ap = argparse.ArgumentParser(description="Adapt ST-AWFD D2 to test-limit-backtester schema.")
    ap.add_argument("--output-dir",       default="data")
    ap.add_argument("--n-features",       type=int,   default=6)
    ap.add_argument("--ref-lot-frac",     type=float, default=0.60)
    ap.add_argument("--spec-percentile",  type=float, default=1.0,
                    help="Spec limits from this percentile to (100-this) of reference data")
    ap.add_argument("--local-file",       default=None,
                    help="Path to local D2.csv if already downloaded")
    args = ap.parse_args()
    adapt(
        output_dir=args.output_dir,
        n_features=args.n_features,
        ref_lot_frac=args.ref_lot_frac,
        spec_percentile=args.spec_percentile,
        local_file=args.local_file,
    )


if __name__ == "__main__":
    main()
