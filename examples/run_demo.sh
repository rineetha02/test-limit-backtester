#!/usr/bin/env bash
# End-to-end demo: generate synthetic data → profile → propose limits → backtest → report
# Run from any directory; the script changes to the repo root automatically.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SEED="${SEED:-42}"

# Support python3 as well as python
PYTHON="${PYTHON:-$(command -v python3 || command -v python)}"

echo "=== test-limit-backtester demo ==="
echo "Repo root: $REPO_ROOT"
echo "Seed: $SEED"
echo ""

mkdir -p data reports/figs

echo "[1/5] Generating synthetic TMR current-sensor data..."
python3 scripts/generate_synthetic_data.py --seed "$SEED" --output-dir data

echo "[2/5] Profiling test parameters (reference lots)..."
python3 scripts/profile_tests.py \
    --data  data/synthetic_test_data.csv \
    --spec  data/parameter_spec.csv \
    --output reports/capability_table.csv \
    --per-lot

echo "[3/5] Proposing PAT and Cpk-target limits..."
python3 scripts/propose_limits.py \
    --data      data/synthetic_test_data.csv \
    --spec      data/parameter_spec.csv \
    --profile   reports/capability_table.csv \
    --pat-sigma 6 \
    --cpk-target 1.33 \
    --mode static \
    --output reports/proposed_limits.csv

echo "[4/5] Backtesting against holdout lots..."
python3 scripts/backtest.py \
    --data      data/synthetic_test_data.csv \
    --limits    reports/proposed_limits.csv \
    --spec      data/parameter_spec.csv \
    --output-dir reports

echo "[5/5] Building report..."
python3 scripts/make_report.py \
    --data       data/synthetic_test_data.csv \
    --capability reports/capability_table.csv \
    --limits     reports/proposed_limits.csv \
    --backtest   reports/backtest_results.json \
    --spec       data/parameter_spec.csv \
    --output-dir reports \
    --seed       "$SEED"

echo ""
echo "=== Done ==="
echo "  Markdown report : $REPO_ROOT/reports/report.md"
echo "  HTML report     : $REPO_ROOT/reports/report.html"
echo "  Histograms      : $REPO_ROOT/reports/figs/"
