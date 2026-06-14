/**
 * Client-side ports of the pipeline's statistical formulas.
 * All math must match profile_tests.py and propose_limits.py exactly.
 */

import type { HistogramBin, LimitLine, UploadResult } from "./types";

export function robustSigma(values: number[]): number {
  const sorted = [...values].filter(isFinite).sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 2) return 0;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return (q3 - q1) / 1.35;
}

function quantile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function median(values: number[]): number {
  return quantile([...values].filter(isFinite).sort((a, b) => a - b), 0.5);
}

export function cpk(
  mean: number,
  sigma: number,
  lsl: number | null,
  usl: number | null,
  sided: "two" | "upper" | "lower"
): number | null {
  if (!isFinite(sigma) || sigma < 1e-10) return null;
  if (sided === "two" && lsl !== null && usl !== null) {
    return Math.min((usl - mean) / (3 * sigma), (mean - lsl) / (3 * sigma));
  }
  if (sided === "upper" && usl !== null) {
    return (usl - mean) / (3 * sigma);
  }
  if (sided === "lower" && lsl !== null) {
    return (mean - lsl) / (3 * sigma);
  }
  return null;
}

export function cpkRating(v: number | null): "not_capable" | "marginal" | "capable" | "excellent" {
  if (v === null || !isFinite(v)) return "not_capable";
  if (v < 1.0) return "not_capable";
  if (v < 1.33) return "marginal";
  if (v < 1.67) return "capable";
  return "excellent";
}

export function patLimits(
  values: number[],
  lsl: number | null,
  usl: number | null,
  nSigma = 6
): { lower: number | null; upper: number | null } {
  const med = median(values);
  const rs = robustSigma(values);
  let lower = lsl !== null ? med - nSigma * rs : null;
  let upper = usl !== null ? med + nSigma * rs : null;
  // clamp to spec
  if (lower !== null && lsl !== null) lower = Math.max(lower, lsl);
  if (upper !== null && usl !== null) upper = Math.min(upper, usl);
  return { lower, upper };
}

export function histogram(values: number[], nBins = 40): HistogramBin[] {
  const clean = values.filter(isFinite);
  if (clean.length < 2) return [];
  const mn = Math.min(...clean);
  const mx = Math.max(...clean);
  if (mx - mn < 1e-10) return [];
  const step = (mx - mn) / nBins;
  const bins: HistogramBin[] = Array.from({ length: nBins }, (_, i) => ({
    x0: mn + i * step,
    x1: mn + (i + 1) * step,
    count: 0,
  }));
  for (const v of clean) {
    const idx = Math.min(Math.floor((v - mn) / step), nBins - 1);
    bins[idx].count++;
  }
  return bins;
}

/** Compute upload results for one or more numeric columns. */
export function analyzeUpload(
  rows: Record<string, number>[],
  paramCols: string[]
): UploadResult[] {
  return paramCols.map((col) => {
    const values = rows.map((r) => r[col]).filter((v) => isFinite(v));
    const n = values.length;
    if (n < 5) {
      return {
        parameter: col,
        unit: "",
        n,
        mean: 0,
        robust_sigma: 0,
        cpk: null,
        lsl: null,
        usl: null,
        pat_lower: null,
        pat_upper: null,
        yield_loss: 0,
        screened_count: 0,
        bins: [],
        lines: [],
      };
    }
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const rs = robustSigma(values);
    // Infer limits at mean ± 4 * sigma (for Cpk display; no formal spec)
    const inferredLsl = mean - 4 * rs;
    const inferredUsl = mean + 4 * rs;
    const cpkVal = cpk(mean, rs, inferredLsl, inferredUsl, "two");
    const pat = patLimits(values, inferredLsl, inferredUsl);

    let screened = 0;
    for (const v of values) {
      const belowPat = pat.lower !== null && v < pat.lower;
      const abovePat = pat.upper !== null && v > pat.upper;
      const belowSpec = v < inferredLsl;
      const aboveSpec = v > inferredUsl;
      if (belowPat || abovePat || belowSpec || aboveSpec) screened++;
    }

    const bins = histogram(values);
    const lines: LimitLine[] = [];
    lines.push({ label: "Inferred LSL", value: inferredLsl, style: "solid", color: "spec" });
    lines.push({ label: "Inferred USL", value: inferredUsl, style: "solid", color: "spec" });
    if (pat.lower !== null) lines.push({ label: "PAT lower", value: pat.lower, style: "dashed", color: "pat" });
    if (pat.upper !== null) lines.push({ label: "PAT upper", value: pat.upper, style: "dashed", color: "pat" });

    return {
      parameter: col,
      unit: "",
      n,
      mean,
      robust_sigma: rs,
      cpk: cpkVal,
      lsl: inferredLsl,
      usl: inferredUsl,
      pat_lower: pat.lower,
      pat_upper: pat.upper,
      yield_loss: screened / n,
      screened_count: screened,
      bins,
      lines,
    };
  });
}
