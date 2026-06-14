"use client";

import { useState } from "react";
import type { LimitsRow, HistogramData } from "@/lib/types";
import { GlossaryChip } from "@/components/ui/GlossaryChip";
import { HistogramChart } from "@/components/charts/HistogramChart";

interface Props {
  limits: LimitsRow[];
  histograms: HistogramData[];
  onNext: () => void;
  onBack: () => void;
}

export function LimitsStage({ limits, histograms, onNext, onBack }: Props) {
  const [mode, setMode] = useState<"spec" | "pat">("spec");
  const histMap = new Map(histograms.map((h) => [h.parameter, h]));

  const specLines = (h: HistogramData) => h.lines.filter((l) => l.color === "spec");
  const patLines = (h: HistogramData) => h.lines.filter((l) => l.color !== "cpk-target");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Proposed limits</h2>
        <p className="text-sm text-ink-soft mt-1">
          <GlossaryChip id="pat">PAT limits</GlossaryChip> are set at robust median{" "}
          +/- 6 x <GlossaryChip id="robust_sigma">robust sigma</GlossaryChip>, clamped to
          spec. Toggle to see them drawn on the distributions.
          Two-sided PAT is applied even to one-sided specs: PAT is a reliability screen for
          statistical anomalies in either direction, independent of which direction the datasheet
          limit covers.
        </p>
      </div>

      {/* Toggle */}
      <div
        data-no-print
        className="inline-flex rounded-lg border border-border bg-surface-alt p-1 gap-1"
        role="group"
        aria-label="Limit view mode"
      >
        {(["spec", "pat"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-brand cursor-pointer
              ${mode === m ? "bg-white shadow text-ink" : "text-ink-soft hover:text-ink"}`}
          >
            {m === "spec" ? "Spec limits only" : "PAT limits"}
          </button>
        ))}
      </div>

      {/* Limits table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="text-left px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Parameter</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Spec LSL</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Spec USL</th>
              <th className="text-right px-4 py-2.5 font-medium text-spec text-xs uppercase tracking-wide">PAT lower</th>
              <th className="text-right px-4 py-2.5 font-medium text-pat text-xs uppercase tracking-wide">PAT upper</th>
              <th className="text-center px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Clamped</th>
            </tr>
          </thead>
          <tbody>
            {limits.map((row, i) => (
              <tr
                key={row.parameter}
                className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-surface-alt/50"}`}
              >
                <td className="px-4 py-2.5 font-medium text-ink text-xs">{row.parameter}</td>
                <td className="px-4 py-2.5 text-right font-data text-xs text-ink-soft">
                  {row.lsl !== null ? row.lsl.toFixed(4) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-data text-xs text-ink-soft">
                  {row.usl !== null ? row.usl.toFixed(4) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-data text-xs text-pat">
                  {row.pat_lower !== null ? row.pat_lower.toFixed(4) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-data text-xs text-pat">
                  {row.pat_upper !== null ? row.pat_upper.toFixed(4) : "—"}
                </td>
                <td className="px-4 py-2.5 text-center text-xs">
                  {row.clamped_to_spec ? (
                    <span className="text-amber-700 font-medium">Yes</span>
                  ) : (
                    <span className="text-ink-soft">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Histograms with limit lines */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-1">
          Distributions with{" "}
          <span className={mode === "spec" ? "text-spec" : "text-pat"}>
            {mode === "spec" ? "spec limits" : "PAT limits"}
          </span>
        </h3>
        <p className="text-xs text-ink-soft mb-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 border-t-2 border-spec inline-block" /> Spec (solid)
          </span>{" "}
          <span className="inline-flex items-center gap-1 ml-3">
            <span className="w-3 border-t-2 border-pat border-dashed inline-block" /> PAT (dashed)
          </span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {limits.map((row) => {
            const hist = histMap.get(row.parameter);
            if (!hist) return null;
            const lines = mode === "spec" ? specLines(hist) : patLines(hist);
            const catchZone =
              mode === "pat"
                ? { lower: row.pat_lower, upper: row.pat_upper }
                : undefined;
            return (
              <div key={row.parameter} className="rounded-xl border border-border bg-white p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs font-semibold text-ink">{row.parameter}</span>
                  <span className="text-xs text-ink-soft">{row.unit}</span>
                </div>
                <HistogramChart
                  bins={hist.bins}
                  lines={lines}
                  unit={row.unit}
                  height={130}
                  highlightZone={catchZone}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-border text-sm text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-deep transition-colors"
        >
          Continue to Backtest
        </button>
      </div>
    </div>
  );
}
