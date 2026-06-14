"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import { Upload, AlertCircle } from "lucide-react";
import type { UploadResult } from "@/lib/types";
import { analyzeUpload } from "@/lib/formulas";
import { HistogramChart } from "@/components/charts/HistogramChart";
import { HonestyBadge } from "@/components/ui/HonestyBadge";

const RESERVED_COLS = new Set(["lot_id", "wafer_id", "die_x", "die_y", "lot_role", "true_latent_fail", "spec_fail", "maverick_reason", "part_id"]);

export function UploadFlow() {
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setResults(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        if (!parsed.data.length) {
          setError("No rows found in the file.");
          return;
        }
        const cols = Object.keys(parsed.data[0]).filter(
          (c) => !RESERVED_COLS.has(c.toLowerCase())
        );
        const numericCols = cols.filter((col) => {
          const vals = parsed.data.map((r) => Number(r[col]));
          return vals.filter(isFinite).length >= 5;
        });
        if (!numericCols.length) {
          setError(
            "No numeric columns found. Provide at least one column of measurements with 5 or more valid values."
          );
          return;
        }
        const rows = parsed.data.map((r) => {
          const out: Record<string, number> = {};
          for (const c of numericCols) out[c] = Number(r[c]);
          return out;
        });
        const res = analyzeUpload(rows, numericCols);
        setResults(res);
      },
      error: (err) => setError(`Parse error: ${err.message}`),
    });
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Upload your data</h2>
        <p className="text-sm text-ink-soft mt-1">
          Upload a CSV with one or more numeric measurement columns. The browser computes
          Cpk, PAT limits, and histograms locally — no data leaves your machine.
        </p>
        <div className="mt-2">
          <HonestyBadge type="no-ground-truth" />
          <span className="text-xs text-ink-soft ml-2">
            Without maverick labels, recall cannot be computed. Spec limits are inferred at mean +/- 4
            sigma.
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors
          ${dragging ? "border-brand bg-brand-tint" : "border-border bg-surface-alt hover:border-brand/50 hover:bg-brand-tint/30"}`}
      >
        <Upload size={28} className={dragging ? "text-brand" : "text-ink-soft"} />
        <span className="text-sm text-ink">Drop a CSV here, or click to browse</span>
        {fileName && (
          <span className="text-xs text-brand-deep font-medium">{fileName}</span>
        )}
        <input type="file" accept=".csv" className="sr-only" onChange={onInputChange} />
      </label>

      {/* Sample download */}
      <p className="text-xs text-ink-soft">
        No data handy?{" "}
        <a href="/sample.csv" download className="text-brand-deep underline underline-offset-2 hover:text-brand">
          Download sample.csv
        </a>{" "}
        to try the upload path in one click.
      </p>

      {/* Error */}
      {error && (
        <div className="flex gap-2 items-start rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-soft uppercase tracking-wide">Parameter</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-soft uppercase tracking-wide">n</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-soft uppercase tracking-wide">Mean</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-soft uppercase tracking-wide">Robust sigma</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-soft uppercase tracking-wide">Cpk (inferred)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-soft uppercase tracking-wide">PAT yield loss</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.parameter} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-surface-alt/50"}`}>
                    <td className="px-4 py-2.5 font-medium text-ink text-xs">{r.parameter}</td>
                    <td className="px-4 py-2.5 text-right font-data text-xs">{r.n}</td>
                    <td className="px-4 py-2.5 text-right font-data text-xs">{r.mean.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right font-data text-xs">{r.robust_sigma.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right font-data text-xs font-semibold">{r.cpk !== null ? r.cpk.toFixed(2) : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-data text-xs">{(r.yield_loss * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <div key={r.parameter} className="rounded-xl border border-border bg-white p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs font-semibold text-ink">{r.parameter}</span>
                  <span className="text-xs text-ink-soft">n={r.n}</span>
                </div>
                <HistogramChart bins={r.bins} lines={r.lines} height={130} />
                <div className="flex gap-3 mt-2 text-xs text-ink-soft">
                  <span className="flex items-center gap-1">
                    <span className="w-3 border-t-2 border-spec inline-block" /> Inferred spec
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 border-t-2 border-dashed border-pat inline-block" /> PAT
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
