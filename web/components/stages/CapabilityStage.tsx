"use client";

import type { CapabilityRow, HistogramData } from "@/lib/types";
import { GlossaryChip } from "@/components/ui/GlossaryChip";
import { HistogramChart } from "@/components/charts/HistogramChart";

interface Props {
  capability: CapabilityRow[];
  histograms: HistogramData[];
  onNext: () => void;
  onBack: () => void;
}

const RATING_STYLE: Record<string, string> = {
  not_capable: "text-not-capable bg-red-50 border-red-200",
  marginal: "text-marginal bg-amber-50 border-amber-200",
  capable: "text-capable bg-teal-50 border-teal-200",
  excellent: "text-excellent bg-emerald-50 border-emerald-200",
};

const RATING_LABEL: Record<string, string> = {
  not_capable: "Not capable",
  marginal: "Marginal",
  capable: "Capable",
  excellent: "Excellent",
};

export function CapabilityStage({ capability, histograms, onNext, onBack }: Props) {
  const histMap = new Map(histograms.map((h) => [h.parameter, h]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Process capability</h2>
        <p className="text-sm text-ink-soft mt-1">
          <GlossaryChip id="cpk">Cpk</GlossaryChip> uses{" "}
          <GlossaryChip id="robust_sigma">robust sigma</GlossaryChip> (IQR / 1.35) from the
          reference lots. Higher Cpk means the process is comfortably within spec.
        </p>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="text-left px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Parameter</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Spec</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Mean</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Robust sigma</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Cp</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Cpk</th>
              <th className="text-right px-4 py-2.5 font-medium text-ink-soft text-xs uppercase tracking-wide">Rating</th>
            </tr>
          </thead>
          <tbody>
            {capability.map((row, i) => (
              <tr
                key={row.parameter}
                className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-surface-alt/50"}`}
              >
                <td className="px-4 py-2.5 font-medium text-ink text-xs">{row.parameter}</td>
                <td className="px-4 py-2.5 text-right font-data text-xs text-ink-soft">
                  {row.spec_sided === "two"
                    ? `${row.lsl} to ${row.usl} ${row.unit}`
                    : row.spec_sided === "upper"
                    ? `≤${row.usl} ${row.unit}`
                    : `≥${row.lsl} ${row.unit}`}
                </td>
                <td className="px-4 py-2.5 text-right font-data text-xs">
                  {row.mean.toFixed(3)}
                </td>
                <td className="px-4 py-2.5 text-right font-data text-xs">
                  {row.robust_sigma.toFixed(3)}
                </td>
                <td className="px-4 py-2.5 text-right font-data text-xs">
                  {row.cp !== null ? row.cp.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-data text-xs font-semibold">
                  {row.cpk !== null ? row.cpk.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                      RATING_STYLE[row.rating] ?? ""
                    }`}
                  >
                    {RATING_LABEL[row.rating] ?? row.rating}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Histograms */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Reference lot distributions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capability.map((row) => {
            const hist = histMap.get(row.parameter);
            if (!hist) return null;
            return (
              <div key={row.parameter} className="rounded-xl border border-border bg-white p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs font-semibold text-ink">{row.parameter}</span>
                  <span className="text-xs text-ink-soft ml-1">{row.unit}</span>
                </div>
                <HistogramChart bins={hist.bins} lines={[]} unit={row.unit} height={130} />
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
          Continue to Limits
        </button>
      </div>
    </div>
  );
}
