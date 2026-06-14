"use client";

import type { DriftData } from "@/lib/types";
import { GlossaryChip } from "@/components/ui/GlossaryChip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  drift: DriftData;
  onNext: () => void;
  onBack: () => void;
}

export function DynamicPatStage({ drift, onNext, onBack }: Props) {
  const { dynamic_pat } = drift;

  const chartData = dynamic_pat.map((d) => ({
    lot: d.lot_id,
    static: d.yield_loss_static,
    dynamic: d.yield_loss_dynamic,
    drifted: d.drifted,
    fp_static: d.fp_static,
    fp_dynamic: d.fp_dynamic,
  }));

  const lot10 = dynamic_pat.find((d) => d.drifted);
  const totalFpStatic = dynamic_pat.reduce((s, d) => s + d.fp_static, 0);
  const totalFpDynamic = dynamic_pat.reduce((s, d) => s + d.fp_dynamic, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-ink">Dynamic PAT</h2>
        <p className="text-sm text-ink-soft mt-1">
          <GlossaryChip id="static_pat">Static PAT</GlossaryChip> freezes limits at reference-lot
          statistics. <GlossaryChip id="dynamic_pat">Dynamic PAT</GlossaryChip> recomputes limits
          before each lot using all lots seen so far. When a process drifts, the limits track it
          — dramatically reducing false positives on drifted lots.
        </p>
      </div>

      {/* Headline callout */}
      {lot10 && (
        <div className="rounded-2xl border-2 border-brand bg-brand-tint p-6">
          <h3 className="text-sm font-semibold text-ink mb-4 text-center">
            LOT10 false rejects: static PAT vs dynamic PAT
          </h3>
          <div className="flex items-center justify-around gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className="font-data text-4xl font-bold text-not-capable">
                {(lot10.yield_loss_static * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-ink-soft">{lot10.fp_static} false rejects</span>
              <span className="text-xs font-medium text-not-capable">Static PAT</span>
            </div>
            <div className="text-2xl text-ink-soft">→</div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-data text-4xl font-bold text-brand-deep">
                {(lot10.yield_loss_dynamic * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-ink-soft">{lot10.fp_dynamic} false reject</span>
              <span className="text-xs font-medium text-brand-deep">Dynamic PAT</span>
            </div>
          </div>
          <p className="text-center text-xs text-ink-soft mt-4">
            {lot10.fp_static - lot10.fp_dynamic} fewer good parts scrapped. Zero mavericks escape in either case.
          </p>
        </div>
      )}

      {/* Bar chart */}
      <div className="rounded-xl border border-border bg-white p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">
          False-reject yield loss by lot: static vs dynamic
        </h3>
        <div role="img" aria-label="Yield loss comparison static vs dynamic PAT">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <XAxis
                dataKey="lot"
                tick={{ fontSize: 10, fill: "#46606B" }}
                tickLine={false}
                axisLine={{ stroke: "#D9E3E6" }}
              />
              <YAxis
                tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                tick={{ fontSize: 10, fill: "#46606B" }}
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
              />
              <Tooltip
                formatter={(v, name) => [
                  `${(Number(v) * 100).toFixed(2)}%`,
                  name === "static" ? "Static PAT" : "Dynamic PAT",
                ]}
                contentStyle={{ fontSize: 12, border: "1px solid #D9E3E6", borderRadius: 6 }}
              />
              <Legend
                formatter={(v) => (v === "static" ? "Static PAT" : "Dynamic PAT")}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="static" maxBarSize={28}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.drifted ? "#D32F2F" : "#00857C"}
                  />
                ))}
              </Bar>
              <Bar dataKey="dynamic" fill="#F59E0B" maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-xs text-ink-soft mt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand inline-block" /> Static (stable lots)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-spec inline-block" /> Static (drifted lot)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-pat inline-block" /> Dynamic (all lots)
          </span>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-surface-alt px-5 py-4 space-y-2">
        <h3 className="text-sm font-semibold text-ink">How it works</h3>
        <ul className="space-y-1.5 text-sm text-ink">
          <li className="flex gap-2">
            <span className="text-brand mt-0.5">1.</span>
            <span>Before LOT07 is screened, compute PAT limits from LOT01–LOT06 (same as static).</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand mt-0.5">2.</span>
            <span>Before LOT08, recompute from LOT01–LOT07. The drift in LOT07 shifts the robust median slightly, widening the upper limit.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand mt-0.5">3.</span>
            <span>By LOT10, prior lots LOT01–LOT09 span the full drift ramp. The dynamic upper limit reaches the spec wall (+8 mV), so LOT10&apos;s drifted parts are no longer false-flagged.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand mt-0.5">✓</span>
            <span>
              Across all holdout lots: <strong>{totalFpStatic} static FP</strong> → <strong>{totalFpDynamic} dynamic FP</strong>. Zero mavericks escape in either case — recall stays 100%.
            </span>
          </li>
        </ul>
      </div>

      {/* Tradeoff note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
        <strong>Tradeoff to watch:</strong> Dynamic limits that track a drifting process may
        mask a real reliability shift. In production, dynamic PAT should run alongside{" "}
        <strong>SPC control charts</strong> so process drift triggers an investigation — not just
        a limit adjustment.
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
          Continue to Takeaway
        </button>
      </div>
    </div>
  );
}
