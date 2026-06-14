import type {
  DatasetId,
  DatasetBundle,
  DatasetMeta,
  CapabilityRow,
  LimitsRow,
  HistogramData,
  BacktestData,
  DriftData,
} from "./types";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadDataset(id: DatasetId): Promise<DatasetBundle> {
  const base = `/data/${id}`;
  const [meta, capability, limits, histograms, backtest] = await Promise.all([
    fetchJson<DatasetMeta>(`${base}/meta.json`),
    fetchJson<CapabilityRow[]>(`${base}/capability.json`),
    fetchJson<LimitsRow[]>(`${base}/limits.json`),
    fetchJson<HistogramData[]>(`${base}/histograms.json`),
    fetchJson<BacktestData>(`${base}/backtest.json`),
  ]);

  let drift: DriftData | undefined;
  if (id === "synthetic") {
    try {
      drift = await fetchJson<DriftData>(`${base}/drift.json`);
    } catch {
      // optional
    }
  }

  return { meta, capability, limits, histograms, backtest, drift };
}
