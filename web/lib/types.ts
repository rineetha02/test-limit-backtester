export type DatasetId = "synthetic" | "secom" | "stsawfd";

export interface DatasetMeta {
  dataset_id: DatasetId;
  display_name: string;
  subtitle: string;
  source: string;
  source_url: string | null;
  has_ground_truth: boolean;
  parts_total: number;
  lots_total: number;
  by_construction: boolean;
  caveat: string | null;
}

export type CpkRating = "not_capable" | "marginal" | "capable" | "excellent";
export type SpecSided = "two" | "upper" | "lower";

export interface CapabilityRow {
  parameter: string;
  unit: string;
  lsl: number | null;
  usl: number | null;
  mean: number;
  robust_sigma: number;
  cp: number | null;
  cpk: number | null;
  rating: CpkRating;
  spec_sided: SpecSided;
}

export interface LimitsRow {
  parameter: string;
  unit: string;
  lsl: number | null;
  usl: number | null;
  pat_lower: number | null;
  pat_upper: number | null;
  cpk_target_lower: number | null;
  cpk_target_upper: number | null;
  clamped_to_spec: boolean;
}

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
}

export type LimitColor = "spec" | "pat" | "cpk-target";

export interface LimitLine {
  label: string;
  value: number;
  style: "solid" | "dashed";
  color: LimitColor;
}

export interface HistogramData {
  parameter: string;
  unit: string;
  bins: HistogramBin[];
  lines: LimitLine[];
}

export interface ScreenStats {
  recall: number | null;
  escape_dppm: number | null;
  yield_loss_overall: number;
  tp: number | null;
  fn: number | null;
  fp: number;
  tn: number;
}

export interface LotYieldLoss {
  lot: string;
  yield_loss: number;
  drifted: boolean;
}

export interface DriftInfo {
  param: string;
  cpk_reference: number;
  cpk_drifted: number;
  drifted_lot: string;
  shift_mv: number;
}

export interface BacktestData {
  has_ground_truth: boolean;
  screens: {
    pat: ScreenStats;
    spec_only: ScreenStats;
  };
  yield_loss_by_lot: LotYieldLoss[];
  drift: DriftInfo | null;
}

export interface DynamicPatLot {
  lot_id: string;
  drifted: boolean;
  fp_static: number;
  fp_dynamic: number;
  yield_loss_static: number;
  yield_loss_dynamic: number;
}

export interface DriftLotCpk {
  lot_id: string;
  cpk: number;
  role: "reference" | "holdout";
  drifted: boolean;
}

export interface DriftData {
  parameter: string;
  unit: string;
  pat_lower: number | null;
  pat_upper: number | null;
  spec_lower: number;
  spec_upper: number;
  shift_mv: number;
  reference: {
    mean: number;
    cpk: number;
    bins: HistogramBin[];
  };
  lot10: {
    mean: number;
    cpk: number;
    yield_loss: number;
    fp_count: number;
    bins: HistogramBin[];
  };
  lot_cpk_trend: DriftLotCpk[];
  dynamic_pat: DynamicPatLot[];
}

export interface DatasetBundle {
  meta: DatasetMeta;
  capability: CapabilityRow[];
  limits: LimitsRow[];
  histograms: HistogramData[];
  backtest: BacktestData;
  drift?: DriftData;
}

// Client-side upload result
export interface UploadResult {
  parameter: string;
  unit: string;
  n: number;
  mean: number;
  robust_sigma: number;
  cpk: number | null;
  lsl: number | null;
  usl: number | null;
  pat_lower: number | null;
  pat_upper: number | null;
  yield_loss: number;
  screened_count: number;
  bins: HistogramBin[];
  lines: LimitLine[];
}
