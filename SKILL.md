---
name: test-limit-backtester
description: >
  Analyze semiconductor parametric test data to set and validate test limits.
  Use this skill whenever the user mentions test limits, Part Average Testing or PAT,
  Cpk or process capability, parametric test data, wafer or lot yield, outlier or
  maverick screening, guardbanding, test escapes or over-kill, STDF/bin data, or
  wants to backtest a proposed limit or screen against historical lots — even if they
  don't name the method. Computes Cp/Cpk, proposes AEC-Q001-style PAT and Cpk-target
  limits, and backtests them against held-out lots to quantify defects caught vs.
  good parts rejected.
---

# test-limit-backtester

## Overview

This skill automates the core semiconductor test-engineering task of setting and validating
**parametric test limits**. Given a table of parametric measurements, it: (1) computes
per-parameter capability statistics (Cp, Cpk) using both standard and robust estimators;
(2) proposes statistically-derived **Part Average Testing (PAT)** outlier limits per the
AEC-Q001 method and **Cpk-target guardbands**; (3) **backtests** those limits against
held-out historical lots, quantifying how many latent defects they would have caught
versus how many good parts they would have wrongly rejected (over-kill/yield loss);
and (4) produces an engineer-ready Markdown + HTML report with per-parameter histograms.
If no user data is supplied, the skill generates fully synthetic TMR current-sensor
data with planted ground-truth defects so the demo runs end-to-end with no external input.

## When to use

Trigger this skill when the user asks about any of:
- Setting, reviewing, or tightening test limits or guardbands
- Part Average Testing, PAT, DPAT, or AEC-Q001
- Cp, Cpk, or process capability analysis of test parameters
- Maverick screening, outlier detection in parametric data
- Yield loss from test limits or over-kill estimation
- Test escapes, field DPPM reduction, or reliability screening
- Backtesting or validating proposed limits against historical lots
- Lot or wafer yield analysis on parametric data
- STDF or bin data analysis (adapt input path; CSV schema below)

## Workflow

```
[User provides CSV]  ──or──  [Run generate_synthetic_data.py]
         │
         ▼
  profile_tests.py          (Cp/Cpk, robust stats, per-parameter)
         │
         ▼
  propose_limits.py         (PAT limits, Cpk-target limits)
         │
         ▼
  backtest.py               (confusion matrix, recall, DPPM, yield loss)
         │
         ▼
  make_report.py            (Markdown + HTML report with histograms)
```

**Step 0 — Data source:**
- If the user supplies a CSV, use it directly (schema below).
- Otherwise run: `python scripts/generate_synthetic_data.py --seed 42`
  This creates `data/synthetic_test_data.csv` and `data/parameter_spec.csv`.

**Step 1 — Profile:**
```bash
python scripts/profile_tests.py \
    --data  <data.csv> \
    --spec  <parameter_spec.csv> \
    --output reports/capability_table.csv
```

**Step 2 — Propose limits:**
```bash
python scripts/propose_limits.py \
    --data      <data.csv> \
    --spec      <parameter_spec.csv> \
    --profile   reports/capability_table.csv \
    --pat-sigma 6 \
    --cpk-target 1.33 \
    --output reports/proposed_limits.csv
```

**Step 3 — Backtest:**
```bash
python scripts/backtest.py \
    --data   <data.csv> \
    --limits reports/proposed_limits.csv \
    --spec   <parameter_spec.csv> \
    --output-dir reports/
```

**Step 4 — Report:**
```bash
python scripts/make_report.py \
    --data       <data.csv> \
    --capability reports/capability_table.csv \
    --limits     reports/proposed_limits.csv \
    --backtest   reports/backtest_results.json \
    --spec       <parameter_spec.csv> \
    --output-dir reports/
```

Or run everything at once: `bash examples/run_demo.sh`

## Input CSV schema

### `<data>.csv` — one row per part
| Column | Type | Description |
|--------|------|-------------|
| `part_id` | int | Unique part identifier |
| `lot_id` | str | Lot label (e.g. `LOT01`) |
| `wafer_id` | str | Wafer label |
| `die_x`, `die_y` | int | Die grid coordinates |
| `lot_role` | str | `reference` (limit-setting) or `holdout` (backtest) |
| `<param_1>` … `<param_N>` | float | One column per test parameter |
| `true_latent_fail` | int | 1 = known latent defect (maverick), 0 = good |
| `spec_fail` | int | 1 = genuine spec failure (separate from latent fail) |
| `maverick_reason` | str | Free text; empty for non-mavericks |

If you are using real data and do not have `true_latent_fail`, set all values to 0;
the backtest will still produce PAT vs spec-only confusion tables, but recall/DPPM
will be undefined and the ground-truth comparison section will be marked N/A.

### `parameter_spec.csv` — one row per test parameter
| Column | Type | Description |
|--------|------|-------------|
| `parameter` | str | Must match column name in data CSV |
| `unit` | str | Display unit (e.g. `mV`, `%`) |
| `lsl` | float or blank | Lower spec limit (blank if none) |
| `usl` | float or blank | Upper spec limit (blank if blank) |
| `sided` | str | `two`, `upper`, or `lower` |

## Important: statistics come from scripts, not the model

All Cp, Cpk, PAT limits, recall, DPPM, and yield-loss numbers are computed by the
Python scripts. The model's role is to orchestrate the pipeline, read the output CSVs
and JSON, and write the narrative interpretation. **The model must never compute or
estimate statistics itself** — always defer to script output.

## Glossary

| Term | Definition |
|------|-----------|
| **Cp** | Process capability index (two-sided only): `(USL−LSL)/(6σ)`. Measures how wide the spec is relative to the process spread. Does not account for centering. |
| **Cpk** | Process capability index accounting for centering: `min((USL−μ)/(3σ), (μ−LSL)/(3σ))` for two-sided; single formula for one-sided. Automotive minimum: 1.33. Safety-critical: 1.67. |
| **PAT** | Part Average Testing. An AEC-Q001 method that uses robust statistics (median, IQR-based sigma) to flag parts that pass spec but are statistical outliers — "mavericks" that are reliability risks. |
| **Robust sigma** | `IQR / 1.35`. Resistant to outlier inflation; approximately equal to the true sigma for a normal distribution. The 1.35 divisor is the AEC-Q001 convention. |
| **Static PAT** | PAT limits set once from a reference population and applied to all future lots. |
| **Dynamic PAT (DPAT)** | PAT limits recomputed per lot (or per wafer). Adapts to process drift; avoids the elevated over-kill that static limits produce when the mean shifts. |
| **Escape** | A defective part that passes all screening and ships. Quantified as DPPM (defective parts per million shipped). |
| **Over-kill** | A good part rejected by PAT (false positive). Quantified as yield-loss rate (fraction of good parts scrapped). |
| **DPPM** | Defective Parts Per Million. `FN / parts_passing_screen × 1,000,000`. The field-escape rate. |
| **Cpk-target limit** | The test limit that would be required to achieve a specified Cpk target (default 1.33). Shows how much headroom a parameter has and where a tightened guardband would sit. |
