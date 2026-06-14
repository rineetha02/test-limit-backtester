"use client";

import { useState } from "react";
import type { DriftData } from "@/lib/types";
import { GlossaryChip } from "@/components/ui/GlossaryChip";
import { HistogramChart } from "@/components/charts/HistogramChart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  drift: DriftData;
  onNext: () => void;
  onBack: () => void;
}

function CpkGauge({ value, label }: { value: number; label: string }) {
  const color =
    value >= 1.67
      ? "#1C6E66"
      : value >= 1.33
      ? "#3E8F86"
      : value >= 1.0
      ? "#C98A2E"
      : "#B23A3A";
  const label2 =
    value >= 1.67
      ? "Excellent"
      : value >= 1.33
      ? "Capable"
      : value >= 1.0
      ? "Marginal"
      : "Not capable";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-data text-4xl font-bold" style={{ color }}>
        {value.toFixed(2)}
      </span>
      <span className="text-xs font-semibold" style={{ color }}>
        {label2}
      </span>
      <span className="text-xs text-ink-soft">{label}</span>
    </div>
  );
}

export function DriftStage({ drift, onNext, onBack }: Props) {
  const [showLot10, setShowLot10] = useState(false);

  const refLines = [
    { label: "Spec LSL", value: drift.spec_lower, style: "solid" as const, color: "spec" as const },
    { label: "Spec USL", value: drift.spec_upper, style: "solid" as const, color: "spec" as const },
    ...(drift.pat_lower !== null
      ? [{ label: "PAT lower", value: drift.pat_lower, style: "dashed" as const, color: "pat" as const }]
      : []),
    ...(drift.pat_upper !== null
      ? [{ label: "PAT upper", value: drift.pat_upper, style: "dashed" as const, color: "pat" as const }]
      : []),
  ];

  const trendData = drift.lot_cpk_trend.map((d) => ({
    lot: d.lot_id,
    cpk: d.cpk,
    drifted: d.drifted,
    role: d.role,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-ink">Drift spotlight</h2>
        <p className="text-sm text-ink-soft mt-1">
          <strong>LOT10</strong> has a mean shift of +{drift.shift_mv} mV on{" "}
          <code className="font-data text-xs">{drift.parameter}</code>.
          The frozen <GlossaryChip id="static_pat">static PAT</GlossaryChip> limits correctly
          flag the drift as elevated <GlossaryChip id="over_kill">over-kill</GlossaryChip>.
          This is not a bug: it is the detection signal that motivates{" "}
          <GlossaryChip id="dynamic_pat">dynamic PAT</GlossaryChip>.
        </p>
      </div>

      {/* Cpk before/after */}
      <div className="rounded-xl border-2 border-border bg-white p-6">
        <h3 className="text-sm font-semibold text-ink mb-6 text-center">
          offset_voltage Cpk: reference vs LOT10
        </h3>
        <div className="flex items-center justify-around gap-8">
          <CpkGauge value={drift.reference.cpk} label="Reference lots" />
          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl text-ink-soft">→</div>
            <span className="text-xs text-ink-soft">+{drift.shift_mv} mV drift</span>
          </div>
          <CpkGauge value={drift.lot10.cpk} label="LOT10 (drifted)" />
        </div>
        <div className="mt-6 flex justify-center gap-8 text-sm text-ink-soft">
          <span>
            Yield loss (stable lots): <strong className="text-ink">under 1.2%</strong>
          </span>
          <span>
            Yield loss (LOT10):{" "}
            <strong className="text-not-capable">
              {(drift.lot10.yield_loss * 100).toFixed(1)}%
            </strong>
          </span>
        </div>
      </div>

      {/* Distribution overlay */}
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink">
            offset_voltage distribution (reference lots)
          </h3>
          <button
            type="button"
            onClick={() => setShowLot10((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-2 focus-visible:outline-brand cursor-pointer
              ${showLot10 ? "bg-amber-500 border-amber-500 text-white" : "border-border text-ink-soft hover:border-ink-soft hover:text-ink"}`}
          >
            {showLot10 ? "Hide" : "Show"} LOT10
          </button>
        </div>
        <div className="flex gap-4 text-xs text-ink-soft mb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand inline-block" /> Reference
          </span>
          {showLot10 && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> LOT10 (+{drift.shift_mv} mV)
            </span>
          )}
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="border-t-2 border-spec w-4 inline-block" /> Spec
          </span>
          <span className="flex items-center gap-1.5">
            <span className="border-t-2 border-dashed border-pat w-4 inline-block" /> PAT
          </span>
        </div>
        <HistogramChart
          bins={drift.reference.bins}
          lines={refLines}
          unit={drift.unit}
          height={200}
          highlightZone={
            showLot10 ? { lower: null, upper: drift.pat_upper } : undefined
          }
          secondaryBins={showLot10 ? drift.lot10.bins : undefined}
          secondaryColor="#F59E0B"
          secondaryOpacity={0.65}
        />
        {showLot10 && (
          <p className="text-xs text-ink-soft mt-2">
            LOT10 bars extend past the PAT upper limit (dashed). Those parts ({drift.lot10.fp_count}) are
            flagged as over-kill. The spec limit (solid red) still passes them — spec-only screening would miss this shift.
          </p>
        )}
      </div>

      {/* Cpk trend */}
      <div className="rounded-xl border border-border bg-white p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">
          offset_voltage Cpk trend across all lots
        </h3>
        <div role="img" aria-label="Cpk trend by lot">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <XAxis
                dataKey="lot"
                tick={{ fontSize: 9, fill: "#46606B" }}
                tickLine={false}
                axisLine={{ stroke: "#D9E3E6" }}
              />
              <YAxis
                domain={[0, "auto"]}
                tick={{ fontSize: 10, fill: "#46606B" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => [Number(v).toFixed(2), "Cpk"]}
                contentStyle={{ fontSize: 12, border: "1px solid #D9E3E6", borderRadius: 6 }}
              />
              <ReferenceLine y={1.33} stroke="#C98A2E" strokeDasharray="4 3" strokeWidth={1} label={{ value: "1.33 capable", fontSize: 9, fill: "#C98A2E", position: "right" }} />
              <ReferenceLine y={1.67} stroke="#1C6E66" strokeDasharray="4 3" strokeWidth={1} label={{ value: "1.67 excellent", fontSize: 9, fill: "#1C6E66", position: "right" }} />
              <Line
                type="monotone"
                dataKey="cpk"
                stroke="#00857C"
                strokeWidth={2}
                dot={(props) => {
                  const { cx = 0, cy = 0, index = 0 } = props as { cx?: number; cy?: number; index?: number };
                  const d = trendData[index];
                  return (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={d?.drifted ? 6 : 4}
                      fill={d?.drifted ? "#D32F2F" : d?.role === "holdout" ? "#F59E0B" : "#00857C"}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  );
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-xs text-ink-soft mt-2">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-brand inline-block" /> Reference lots
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-pat inline-block" /> Holdout (stable)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-spec inline-block" /> LOT10 (drifted)
          </span>
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
          Continue to Takeaway
        </button>
      </div>
    </div>
  );
}
