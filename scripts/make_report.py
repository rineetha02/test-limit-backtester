"""
Assemble capability, limits, and backtest results into a Markdown + HTML report
with per-parameter histograms.

Usage:
    python make_report.py
        --data       data/synthetic_test_data.csv
        --capability reports/capability_table.csv
        --limits     reports/proposed_limits.csv
        --backtest   reports/backtest_results.json
        --spec       data/parameter_spec.csv
        [--output-dir reports/]
        [--seed 42]
"""

import argparse
import json
import os
import datetime
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


DISCLAIMER = (
    "**SYNTHETIC / REPRESENTATIVE DATA — not from any real company, product, or dataset.** "
    "Generated programmatically for demonstration purposes only."
)

RATING_LABEL = {
    "not_capable": "NOT CAPABLE",
    "marginal":    "MARGINAL",
    "capable":     "CAPABLE",
    "excellent":   "EXCELLENT",
}
RATING_MARK = {
    "not_capable": "[RED]",
    "marginal":    "[AMBER]",
    "capable":     "[GREEN]",
    "excellent":   "[GREEN]",
}


def _fmt(v, decimals=4):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return "—"
    if isinstance(v, float):
        return f"{v:.{decimals}f}"
    return str(v)


def _make_histograms(df_raw, cap_df, lim_df, spec_df, output_dir, lots=None):
    fig_dir = os.path.join(output_dir, "figs")
    os.makedirs(fig_dir, exist_ok=True)

    spec_df["lsl"] = pd.to_numeric(spec_df["lsl"], errors="coerce")
    spec_df["usl"] = pd.to_numeric(spec_df["usl"], errors="coerce")

    if lots:
        plot_df = df_raw[df_raw["lot_id"].isin(lots)]
    else:
        plot_df = df_raw

    paths = {}
    for _, sp in spec_df.iterrows():
        param = sp["parameter"]
        unit  = sp["unit"]
        lsl   = None if pd.isna(sp["lsl"]) else float(sp["lsl"])
        usl   = None if pd.isna(sp["usl"]) else float(sp["usl"])

        vals = plot_df[param].dropna().values

        # Get PAT limits
        lim_row = lim_df[lim_df["parameter"] == param]
        pat_lo  = float(lim_row["pat_lower"].iloc[0]) if len(lim_row) > 0 and pd.notna(lim_row["pat_lower"].iloc[0]) else None
        pat_hi  = float(lim_row["pat_upper"].iloc[0]) if len(lim_row) > 0 and pd.notna(lim_row["pat_upper"].iloc[0]) else None

        # Get Cpk for title
        cap_row = cap_df[cap_df["parameter"] == param]
        cpk = float(cap_row["cpk"].iloc[0]) if len(cap_row) > 0 else None
        rating = cap_row["cpk_rating"].iloc[0] if len(cap_row) > 0 else ""

        fig, ax = plt.subplots(figsize=(8, 4))

        n_bins = min(80, max(20, len(vals) // 50))
        ax.hist(vals, bins=n_bins, color="#4C72B0", alpha=0.65, edgecolor="white",
                linewidth=0.4, label="Test data", density=True)

        # KDE overlay
        from scipy.stats import gaussian_kde
        if len(vals) > 5:
            kde = gaussian_kde(vals, bw_method=0.3)
            x_range = np.linspace(vals.min(), vals.max(), 400)
            ax.plot(x_range, kde(x_range), color="#4C72B0", lw=2, label="KDE")

        legend_handles = []
        if lsl is not None:
            ax.axvline(lsl, color="#d62728", lw=2.0, linestyle="-")
            legend_handles.append(mpatches.Patch(color="#d62728", label=f"Spec LSL = {lsl}"))
        if usl is not None:
            ax.axvline(usl, color="#d62728", lw=2.0, linestyle="-")
            legend_handles.append(mpatches.Patch(color="#d62728", label=f"Spec USL = {usl}"))
        if pat_lo is not None:
            ax.axvline(pat_lo, color="#ff7f0e", lw=1.8, linestyle="--")
            legend_handles.append(mpatches.Patch(color="#ff7f0e", label=f"PAT lower = {pat_lo:.2f}"))
        if pat_hi is not None:
            ax.axvline(pat_hi, color="#ff7f0e", lw=1.8, linestyle="--")
            legend_handles.append(mpatches.Patch(color="#ff7f0e", label=f"PAT upper = {pat_hi:.2f}"))

        cpk_str = f"Cpk = {cpk:.2f} ({RATING_LABEL.get(rating, rating)})" if cpk else ""
        ax.set_title(f"{param}  [{unit}]   {cpk_str}", fontsize=11)
        ax.set_xlabel(f"{param} ({unit})")
        ax.set_ylabel("Density")
        if legend_handles:
            ax.legend(handles=legend_handles, fontsize=8, loc="upper right")
        ax.grid(axis="y", alpha=0.3)
        fig.tight_layout()

        png_name = f"{param}.png"
        png_path = os.path.join(fig_dir, png_name)
        fig.savefig(png_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        paths[param] = os.path.join("figs", png_name)

    return paths


def _drift_param_cpk_per_lot(df_raw, spec_df):
    """Return per-lot Cpk for the drift-tracked parameter (offset_voltage if present,
    else the first two-sided parameter, else the first parameter in spec)."""
    candidates = spec_df[spec_df["parameter"] == "offset_voltage"]
    if len(candidates) == 0:
        candidates = spec_df[spec_df["sided"] == "two"]
    if len(candidates) == 0:
        candidates = spec_df
    if len(candidates) == 0:
        return pd.DataFrame(), None

    sp    = candidates.iloc[0]
    param = sp["parameter"]
    unit  = sp["unit"]
    lsl   = float(sp["lsl"]) if pd.notna(sp["lsl"]) else None
    usl   = float(sp["usl"]) if pd.notna(sp["usl"]) else None

    records = []
    for lot_id in sorted(df_raw["lot_id"].unique()):
        vals  = df_raw[df_raw["lot_id"] == lot_id][param].dropna()
        if len(vals) < 2:
            continue
        mean  = vals.mean()
        sigma = vals.std(ddof=1)
        if sigma == 0:
            cpk = None
        else:
            cpu = (usl - mean) / (3 * sigma) if usl is not None else np.inf
            cpl = (mean - lsl) / (3 * sigma) if lsl is not None else np.inf
            cpk = min(cpu, cpl)
        role = df_raw[df_raw["lot_id"] == lot_id]["lot_role"].iloc[0]
        records.append({
            "lot_id":  lot_id,
            "role":    role,
            f"mean_{unit}": round(mean, 3),
            "sigma":   round(sigma, 4),
            "cpk":     round(cpk, 3) if cpk is not None else None,
        })
    return pd.DataFrame(records), param


def build_report(data_path, capability_path, limits_path, backtest_path,
                 spec_path, output_dir="reports", seed=42):

    df_raw  = pd.read_csv(data_path)
    cap_df  = pd.read_csv(capability_path)
    lim_df  = pd.read_csv(limits_path)
    spec_df = pd.read_csv(spec_path)
    spec_df["lsl"] = pd.to_numeric(spec_df["lsl"], errors="coerce")
    spec_df["usl"] = pd.to_numeric(spec_df["usl"], errors="coerce")

    with open(backtest_path) as f:
        bt = json.load(f)

    os.makedirs(output_dir, exist_ok=True)

    fig_paths = _make_histograms(df_raw, cap_df, lim_df, spec_df, output_dir)

    # Drift table — uses offset_voltage if present, else first two-sided param
    drift_df, drift_param = _drift_param_cpk_per_lot(df_raw, spec_df)
    if drift_df is not None and len(drift_df) > 0:
        first_bad = drift_df[drift_df["cpk"].notna() & (drift_df["cpk"] < 1.33)]["lot_id"]
        first_bad_lot = first_bad.iloc[0] if len(first_bad) > 0 else "none"
    else:
        first_bad_lot = "none"

    run_date = datetime.date.today().isoformat()
    n_ref  = df_raw[df_raw["lot_role"] == "reference"]["lot_id"].nunique()
    n_hold = df_raw[df_raw["lot_role"] == "holdout"]["lot_id"].nunique()
    total  = len(df_raw)

    pat  = bt["pat_overall"]
    spec = bt["spec_only_overall"]
    stab = bt.get("pat_stable_lots") or {}
    drft = bt.get("pat_drifted_lot") or {}

    # --- Executive summary text ---
    recall_pct = f"{100 * pat['recall']:.1f}%" if pat.get("recall") is not None else "N/A"
    spec_recall_pct = f"{100 * spec['recall']:.1f}%" if spec.get("recall") is not None else "N/A"
    yield_loss_pct = f"{100 * pat['yield_loss_rate']:.2f}%" if pat.get("yield_loss_rate") is not None else "N/A"
    escape_dppm = f"{pat['escape_dppm']:.0f}" if pat.get("escape_dppm") is not None else "N/A"
    spec_dppm   = f"{spec['escape_dppm']:.0f}" if spec.get("escape_dppm") is not None else "N/A"

    not_capable = [r["parameter"] for _, r in cap_df.iterrows() if r["cpk_rating"] in ("not_capable", "marginal")]
    flagged_str = ", ".join(not_capable) if not_capable else "none"

    # Build drift sentence if we have drift data for a recognizable parameter
    if drift_df is not None and len(drift_df) > 0 and drift_param:
        last_lot = drift_df.iloc[-1]
        drift_cpk_s = f"{last_lot['cpk']:.2f}" if last_lot["cpk"] is not None else "N/A"
        drift_sentence = (
            f"`{drift_param}` Cpk fell to {drift_cpk_s} in {last_lot['lot_id']} "
            f"(threshold 1.33), with {first_bad_lot} being the first lot below the marginal boundary. "
            f"The elevated over-kill in {last_lot['lot_id']} is consistent with static PAT limits correctly detecting a "
            f"process mean shift — a signal that would prompt switching to dynamic (per-lot) PAT."
        )
    else:
        drift_sentence = ""

    has_ground_truth = (pat["tp"] + pat["fn"]) > 0
    if has_ground_truth:
        defect_sentence = (
            f"PAT screening caught **{pat['tp']} of {pat['tp'] + pat['fn']} planted latent defects** "
            f"({recall_pct} recall), while spec-limit-only testing caught **{spec['tp']}** of the same parts "
            f"({spec_recall_pct} recall) — confirming that every maverick was designed to pass spec. "
        )
    else:
        defect_sentence = (
            "No `true_latent_fail` ground truth is available in this dataset; "
            "recall and escape DPPM metrics are not applicable. "
        )

    exec_summary = (
        defect_sentence
        + f"The overall yield cost of PAT was **{yield_loss_pct}** of holdout parts flagged as over-kill, "
        f"yielding an escape rate of **{escape_dppm} DPPM** vs **{spec_dppm} DPPM** for spec-only screening. "
        f"Capability monitoring flagged **{flagged_str}** as marginal or worse by the end of the holdout window. "
        + drift_sentence
    )

    md_lines = []

    def h(level, text):
        md_lines.append(f"\n{'#' * level} {text}\n")

    def p(text):
        md_lines.append(f"\n{text}\n")

    def rule():
        md_lines.append("\n---\n")

    # --- 1. Header ---
    # Infer a title from the first parameter name — if it looks like a SECOM/generic
    # feature name, use a generic title; otherwise use the TMR sensor title.
    first_param = cap_df["parameter"].iloc[0] if len(cap_df) > 0 else "param"
    if first_param.startswith("param_") or first_param.startswith("feature_"):
        report_title = "Parametric Test Limit Backtest Report"
    else:
        report_title = "TMR Current-Sensor Test Limit Backtest Report"
    md_lines.append(f"# {report_title}\n")
    p(DISCLAIMER)
    p(f"**Run date:** {run_date}  |  **Seed:** {seed}  |  "
      f"**Reference lots:** {n_ref}  |  **Holdout lots:** {n_hold}  |  "
      f"**Total parts:** {total:,}")
    rule()

    # --- 2. Executive summary ---
    h(2, "Executive Summary")
    p(exec_summary)
    rule()

    # --- 3. Capability table ---
    h(2, "Capability Table (Reference Lots)")
    col_headers = ["Parameter", "Unit", "Mean", "Sigma", "Cp", "Cpk", "Rating", "Spec Yield %"]
    rows = []
    for _, r in cap_df.iterrows():
        rows.append([
            r["parameter"],
            r["unit"],
            _fmt(r["mean"], 4),
            _fmt(r["sigma"], 4),
            _fmt(r["cp"], 3) if pd.notna(r["cp"]) else "—",
            _fmt(r["cpk"], 3),
            f"{RATING_MARK.get(r['cpk_rating'],'')} {RATING_LABEL.get(r['cpk_rating'], r['cpk_rating'])}",
            _fmt(r["spec_yield_pct"], 2),
        ])
    _write_md_table(md_lines, col_headers, rows)
    rule()

    # --- 4. Proposed limits table ---
    h(2, "Proposed Limits")
    p("Spec limits are the datasheet pass/fail boundaries. "
      "PAT limits are statistical outlier screens (AEC-Q001 robust mean ± 6 × robust σ) "
      "computed from the reference population and clamped to never exceed spec. "
      "Cpk-target limits show where limits would sit to achieve Cpk = 1.33. "
      "_Note: PAT applies two-sided screening even for one-sided-spec parameters "
      "(e.g. noise, bandwidth), because PAT is a reliability screen for anomalous "
      "behaviour in either direction, independent of the datasheet spec direction._")
    lim_cols = ["Parameter", "Spec LSL", "Spec USL", "PAT Lower", "PAT Upper",
                "CpkTarget Lower", "CpkTarget Upper", "Clamped?"]
    lim_rows = []
    for _, r in lim_df.iterrows():
        lim_rows.append([
            r["parameter"],
            _fmt(r["spec_lsl"], 2),
            _fmt(r["spec_usl"], 2),
            _fmt(r["pat_lower"], 2),
            _fmt(r["pat_upper"], 2),
            _fmt(r["cpk_target_lower"], 2),
            _fmt(r["cpk_target_upper"], 2),
            "YES" if r["pat_clamped_flag"] else "no",
        ])
    _write_md_table(md_lines, lim_cols, lim_rows)
    rule()

    # --- 5. Backtest results ---
    h(2, "Backtest Results — PAT vs Spec-Only Screening")
    p("Applied to holdout lots only. Ground truth is `true_latent_fail` "
      "(mavericks that pass spec but fail PAT). Spec failures (`spec_fail=1`) are "
      "excluded from the latent-escape analysis.")

    bt_cols = ["Metric", "PAT", "Spec-Only"]
    bt_rows = [
        ["Caught (TP)",       str(pat["tp"]),  str(spec["tp"])],
        ["Escape (FN)",       str(pat["fn"]),  str(spec["fn"])],
        ["Over-kill (FP)",    str(pat["fp"]),  str(spec["fp"])],
        ["Correct pass (TN)", str(pat["tn"]),  str(spec["tn"])],
        ["Recall",            _fmt(pat["recall"], 4),     _fmt(spec["recall"], 4)],
        ["Precision (overall)", _fmt(pat["precision"], 4), _fmt(spec["precision"], 4)],
        ["Yield-loss rate",   _fmt(pat["yield_loss_rate"], 4), _fmt(spec["yield_loss_rate"], 4)],
        ["Escape DPPM",       _fmt(pat["escape_dppm"], 1), _fmt(spec["escape_dppm"], 1)],
    ]
    if stab:
        bt_rows.append(["Precision (stable lots only)", _fmt(stab.get("precision"), 4), "—"])
    _write_md_table(md_lines, bt_cols, bt_rows)

    if has_ground_truth:
        punchline = (
            f"**Punchline:** PAT caught **{pat['tp']} of {pat['tp']+pat['fn']}** "
            f"planted latent defects that spec-limit testing passed entirely "
            f"({spec['tp']} caught by spec-only), at a holdout yield cost of "
            f"**{yield_loss_pct}**. Escape DPPM drops from **{spec_dppm}** (spec-only) "
            f"to **{escape_dppm}** (PAT). Elevated FP in the final holdout lot is attributable "
            f"to process drift (see §Drift Finding), not PAT over-aggressiveness."
        )
    else:
        punchline = (
            f"**Summary:** No latent-defect ground truth is present in this dataset. "
            f"PAT flagged **{pat['fp']}** parts as potential outliers (yield-loss rate **{yield_loss_pct}**). "
            f"Spec-only screening flagged **{spec['fp']}** parts. "
            f"Review the per-parameter histograms and PAT limit table to assess whether "
            f"the proposed limits are appropriate for this process."
        )
    p(punchline)

    # Per-lot yield loss
    h(3, "Per-Lot Over-Kill Breakdown (PAT)")
    pl_cols = ["Lot", "Role", "Parts", "Defects", "TP", "FN", "FP", "TN", "Yield Loss %"]
    pl_rows = []
    drifted_lots = bt.get("drifted_lots", ["LOT10"])
    for r in bt["per_lot"]:
        yl = r.get("yield_loss_rate")
        yl_s = f"{100*yl:.2f}%" if yl is not None else "—"
        flag = " ⚠" if r["lot_id"] in drifted_lots else ""
        pl_rows.append([
            r["lot_id"] + flag,
            "holdout",
            str(r["n_parts"]),
            str(r["n_defects"]),
            str(r["tp"]),
            str(r["fn"]),
            str(r["fp"]),
            str(r["tn"]),
            yl_s,
        ])
    _write_md_table(md_lines, pl_cols, pl_rows)
    p("_⚠ = significantly drifted lot; elevated over-kill is static PAT detecting process shift._")

    # Per-parameter catch Pareto
    h(3, "Catch Pareto — TP Contributions by Parameter")
    pareto = sorted(bt["param_catch_pareto"].items(), key=lambda x: -x[1])
    pa_cols = ["Parameter", "Defects Caught (TP)"]
    pa_rows = [[k, str(v)] for k, v in pareto]
    _write_md_table(md_lines, pa_cols, pa_rows)
    rule()

    # --- 6. Drift finding ---
    dp_label = f"`{drift_param}`" if drift_param else "primary parameter"
    h(2, f"Drift Finding — {dp_label} Cpk Trend")
    if drift_df is not None and len(drift_df) > 0:
        p(f"{dp_label} mean drifts upward across holdout lots due to a simulated "
          f"process shift. The static PAT limits (set from the reference population) remain fixed, "
          f"so the drifting distribution progressively encroaches on the PAT upper bound, "
          f"causing increasing over-kill. **{first_bad_lot}** is the first lot where Cpk falls "
          f"below 1.33 (the marginal threshold).")
        # Find the mean column (dynamic — depends on param unit)
        mean_col = [c for c in drift_df.columns if c.startswith("mean_")]
        mean_col_label = mean_col[0].replace("_", " (") + ")" if mean_col else "mean"
        dr_cols = ["Lot", "Role", mean_col_label, "Sigma", "Cpk", "Rating"]
        dr_rows = []
        for _, r in drift_df.iterrows():
            cpk_v = r["cpk"]
            rating = ("NOT CAPABLE" if cpk_v is not None and cpk_v < 1.00
                      else "MARGINAL"  if cpk_v is not None and cpk_v < 1.33
                      else "CAPABLE"   if cpk_v is not None and cpk_v < 1.67
                      else "EXCELLENT" if cpk_v is not None else "—")
            flag = " ←" if r["lot_id"] == first_bad_lot else ""
            mean_val = _fmt(r[mean_col[0]], 3) if mean_col else "—"
            dr_rows.append([
                r["lot_id"],
                r["role"],
                mean_val,
                _fmt(r["sigma"], 4),
                _fmt(cpk_v, 3),
                rating + flag,
            ])
        _write_md_table(md_lines, dr_cols, dr_rows)
        p("_Motivation for dynamic (per-lot) PAT: per-lot robust statistics would adapt to the shifted "
          "mean and maintain low over-kill while still catching true mavericks._")
    else:
        p("_Drift analysis requires a two-sided parameter. No drift data available for this dataset._")
    rule()

    # --- 7. Per-parameter histograms ---
    h(2, "Per-Parameter Histograms")
    p("Solid red lines: spec limits. Dashed orange lines: PAT limits. "
      "Data shown for all lots combined.")
    for _, sp in spec_df.iterrows():
        param = sp["parameter"]
        if param in fig_paths:
            h(3, param)
            md_lines.append(f"\n![{param}]({fig_paths[param]})\n")

    rule()

    # --- 8. Next steps ---
    h(2, "Next Steps / Productionisation Notes")
    md_lines.append("""
- **Native STDF ingestion:** Wire to `pystdf` or equivalent for direct fab tester output;
  replace the CSV input path with an STDF reader adapter.
- **Real reference lots:** Swap the synthetic generator for a query against your SPC/MES database;
  the downstream scripts are agnostic to data origin once the CSV schema matches.
- **Dynamic PAT in production:** Enable `--mode dynamic` in `propose_limits.py` to compute
  per-lot robust statistics; the per-lot over-kill numbers in LOT10 above quantify the gain.
- **Automated monitoring:** Schedule `profile_tests.py --per-lot` as a nightly job; alert when
  any parameter's rolling Cpk falls below 1.33 or PAT over-kill exceeds a threshold.
- **Wafer-map view:** `die_x` / `die_y` columns are present for spatial binning; add a
  wafer-map heatmap to surface spatially-correlated defect modes.
- **Binning integration:** Replace `true_latent_fail` with actual field-return or reliability
  stress fail codes to close the loop between PAT screening and real escapes.
""")

    md_text = "\n".join(md_lines)
    md_path = os.path.join(output_dir, "report.md")
    with open(md_path, "w") as f:
        f.write(md_text)
    print(f"Report (Markdown): {md_path}")

    # HTML render
    html_path = os.path.join(output_dir, "report.html")
    _write_html(html_path, md_text, fig_paths, output_dir)
    print(f"Report (HTML):     {html_path}")

    return md_path


def _write_md_table(lines, headers, rows):
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))
    sep  = "| " + " | ".join("-" * w for w in col_widths) + " |"
    head = "| " + " | ".join(str(headers[i]).ljust(col_widths[i]) for i in range(len(headers))) + " |"
    lines.append(f"\n{head}")
    lines.append(sep)
    for row in rows:
        line = "| " + " | ".join(str(row[i]).ljust(col_widths[i]) for i in range(len(row))) + " |"
        lines.append(line)
    lines.append("")


def _write_html(html_path, md_text, fig_paths, output_dir):
    # Convert minimal Markdown to HTML without external deps
    import html as html_module
    import re

    lines = md_text.split("\n")
    body_parts = []
    in_table = False
    table_buf = []

    def flush_table():
        nonlocal in_table, table_buf
        if not table_buf:
            return
        body_parts.append('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;margin:1em 0;">')
        for i, tl in enumerate(table_buf):
            if set(tl.replace(" ","").replace("|","")) <= set("-:"):
                continue
            cells = [c.strip() for c in tl.strip("|").split("|")]
            tag = "th" if i == 0 else "td"
            body_parts.append("<tr>" + "".join(f"<{tag}>{html_module.escape(c)}</{tag}>" for c in cells) + "</tr>")
        body_parts.append("</table>")
        table_buf = []
        in_table = False

    for line in lines:
        if line.startswith("|"):
            in_table = True
            table_buf.append(line)
            continue
        if in_table:
            flush_table()

        # Headings
        m = re.match(r'^(#{1,4})\s+(.*)', line)
        if m:
            lvl = len(m.group(1))
            txt = _md_inline(m.group(2))
            body_parts.append(f"<h{lvl}>{txt}</h{lvl}>")
            continue
        # HR
        if line.strip() == "---":
            body_parts.append("<hr/>")
            continue
        # Images
        m = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)$', line.strip())
        if m:
            alt  = html_module.escape(m.group(1))
            src  = m.group(2)
            body_parts.append(f'<img src="{src}" alt="{alt}" style="max-width:700px;"/><br/>')
            continue
        # Bullet list items
        if line.strip().startswith("- "):
            body_parts.append(f"<li>{_md_inline(line.strip()[2:])}</li>")
            continue
        # Paragraph
        if line.strip():
            body_parts.append(f"<p>{_md_inline(line)}</p>")
        else:
            body_parts.append("")

    if in_table:
        flush_table()

    html_body = "\n".join(body_parts)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>TMR Test Limit Backtest Report</title>
<style>
  body {{ font-family: Arial, sans-serif; max-width: 1100px; margin: 2em auto; padding: 0 1em; }}
  table {{ border-collapse: collapse; margin: 1em 0; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; }}
  th {{ background: #f0f0f0; }}
  h1,h2,h3 {{ color: #2c3e50; }}
  hr {{ border: none; border-top: 1px solid #ccc; margin: 2em 0; }}
  img {{ border: 1px solid #ddd; border-radius: 4px; }}
  li {{ margin: 4px 0; }}
  code {{ background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""
    with open(html_path, "w") as f:
        f.write(html)


def _md_inline(text):
    import html as html_module
    import re
    text = html_module.escape(text)
    # Bold **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic _text_ or *text*
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    text = re.sub(r'_(.+?)_', r'<em>\1</em>', text)
    # Code `text`
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    return text


def main():
    ap = argparse.ArgumentParser(description="Assemble the test limit backtest report.")
    ap.add_argument("--data",       required=True)
    ap.add_argument("--capability", required=True)
    ap.add_argument("--limits",     required=True)
    ap.add_argument("--backtest",   required=True)
    ap.add_argument("--spec",       required=True)
    ap.add_argument("--output-dir", default="reports")
    ap.add_argument("--seed",       type=int, default=42)
    args = ap.parse_args()

    build_report(
        data_path=args.data,
        capability_path=args.capability,
        limits_path=args.limits,
        backtest_path=args.backtest,
        spec_path=args.spec,
        output_dir=args.output_dir,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
