"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import type { HistogramBin, LimitLine } from "@/lib/types";

interface Props {
  bins: HistogramBin[];
  lines: LimitLine[];
  unit?: string;
  height?: number;
  highlightZone?: { lower: number | null; upper: number | null };
  secondaryBins?: HistogramBin[];
  secondaryColor?: string;
  secondaryOpacity?: number;
}

const COLOR_MAP: Record<string, string> = {
  spec: "#D32F2F",
  pat: "#F59E0B",
  "cpk-target": "#4B9CD3",
};

function formatX(v: number, unit: string) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (abs < 0.01 && abs > 0) return v.toExponential(1);
  return v.toFixed(abs < 10 ? 2 : 1);
}

export function HistogramChart({
  bins,
  lines,
  unit = "",
  height = 180,
  highlightZone,
  secondaryBins,
  secondaryColor = "#F59E0B",
  secondaryOpacity = 0.6,
}: Props) {
  if (!bins.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-ink-soft rounded border border-border"
        style={{ height }}
      >
        Insufficient data
      </div>
    );
  }

  // Map secondary bins to same x positions as primary for overlay
  const secondaryMap = new Map<number, number>();
  if (secondaryBins) {
    for (const b of secondaryBins) {
      const mid = (b.x0 + b.x1) / 2;
      secondaryMap.set(mid, b.count);
    }
  }

  const data = bins.map((b) => {
    const mid = (b.x0 + b.x1) / 2;
    const inCatch =
      highlightZone &&
      (highlightZone.lower !== null ? mid < highlightZone.lower : false) === false &&
      (highlightZone.upper !== null ? mid > highlightZone.upper : false);
    return {
      x: mid,
      count: b.count,
      fill: inCatch ? "#F59E0B" : "#00857C",
      secondary: secondaryMap.get(mid) ?? 0,
    };
  });

  const xMin = bins[0].x0;
  const xMax = bins[bins.length - 1].x1;
  const barWidth = (xMax - xMin) / bins.length;

  return (
    <div role="img" aria-label={`Histogram with ${bins.length} bins`}>
      {/* Hidden accessible table */}
      <table className="sr-only">
        <caption>Histogram data</caption>
        <thead>
          <tr>
            <th>Range</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b, i) => (
            <tr key={i}>
              <td>
                {b.x0.toFixed(2)} to {b.x1.toFixed(2)} {unit}
              </td>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
          barCategoryGap={0}
        >
          <XAxis
            dataKey="x"
            type="number"
            domain={[xMin, xMax]}
            tickFormatter={(v) => formatX(v, unit)}
            tick={{ fontSize: 10, fill: "#46606B" }}
            tickLine={false}
            axisLine={{ stroke: "#D9E3E6" }}
          />
          <YAxis hide />
          <Tooltip
            formatter={(val) => [val ?? 0, "Count"]}
            labelFormatter={(v) => `${formatX(Number(v), unit)} ${unit}`}
            contentStyle={{
              fontSize: 12,
              border: "1px solid #D9E3E6",
              borderRadius: 6,
              color: "#0E2A33",
            }}
          />
          <Bar dataKey="count" isAnimationActive={false}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} fillOpacity={0.85} stroke="none" />
            ))}
          </Bar>
          {secondaryBins && (
            <Bar
              dataKey="secondary"
              fill={secondaryColor}
              fillOpacity={secondaryOpacity}
              isAnimationActive={false}
            />
          )}
          {lines.map((line, i) => (
            <ReferenceLine
              key={i}
              x={line.value}
              stroke={COLOR_MAP[line.color] ?? "#888"}
              strokeWidth={1.5}
              strokeDasharray={line.style === "dashed" ? "4 3" : undefined}
              label={{
                value: line.label,
                position: "insideTopRight",
                fontSize: 9,
                fill: COLOR_MAP[line.color] ?? "#888",
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
