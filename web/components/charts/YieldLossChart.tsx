"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { LotYieldLoss } from "@/lib/types";

interface Props {
  data: LotYieldLoss[];
  height?: number;
}

export function YieldLossChart({ data, height = 200 }: Props) {
  // For large datasets, sample uniformly to keep chart readable
  const MAX_BARS = 40;
  let display = data;
  if (data.length > MAX_BARS) {
    const step = Math.ceil(data.length / MAX_BARS);
    // Always include drifted lots
    const drifted = data.filter((d) => d.drifted);
    const sampled = data.filter((_, i) => i % step === 0);
    // Merge, dedup, keep order
    const merged = [...sampled, ...drifted].filter(
      (v, i, a) => a.findIndex((x) => x.lot === v.lot) === i
    );
    display = merged.sort((a, b) => a.lot.localeCompare(b.lot));
  }

  const avg = data.reduce((s, d) => s + d.yield_loss, 0) / data.length;

  return (
    <div role="img" aria-label="Yield loss by lot">
      {/* sr table */}
      <table className="sr-only">
        <caption>Yield loss by lot</caption>
        <thead>
          <tr>
            <th>Lot</th>
            <th>Yield loss</th>
            <th>Drifted</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.lot}>
              <td>{d.lot}</td>
              <td>{(d.yield_loss * 100).toFixed(2)}%</td>
              <td>{d.drifted ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={display} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <XAxis
            dataKey="lot"
            tick={{ fontSize: 9, fill: "#46606B" }}
            tickLine={false}
            axisLine={{ stroke: "#D9E3E6" }}
            interval={display.length > 10 ? "preserveStartEnd" : 0}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10, fill: "#46606B" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => [`${(Number(v) * 100).toFixed(2)}%`, "Yield loss"]}
            contentStyle={{ fontSize: 12, border: "1px solid #D9E3E6", borderRadius: 6 }}
          />
          <ReferenceLine
            y={avg}
            stroke="#46606B"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{ value: "avg", fontSize: 9, fill: "#46606B", position: "right" }}
          />
          <Bar dataKey="yield_loss" radius={[2, 2, 0, 0]}>
            {display.map((d) => (
              <Cell key={d.lot} fill={d.drifted ? "#D32F2F" : "#00857C"} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {data.length > MAX_BARS && (
        <p className="text-xs text-ink-soft mt-1">
          Showing {display.length} of {data.length} lots. Drifted lots always included.
        </p>
      )}
    </div>
  );
}
