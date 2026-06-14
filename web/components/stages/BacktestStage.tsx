"use client";

import type { BacktestData, DatasetMeta } from "@/lib/types";
import { GlossaryChip } from "@/components/ui/GlossaryChip";
import { HonestyBadge } from "@/components/ui/HonestyBadge";
import { ConfusionMatrix } from "@/components/charts/ConfusionMatrix";
import { YieldLossChart } from "@/components/charts/YieldLossChart";

interface Props {
  backtest: BacktestData;
  meta: DatasetMeta;
  onNext: () => void;
  onBack: () => void;
  hasDrift?: boolean;
}

function pct(v: number | null, decimals = 1) {
  if (v === null) return "N/A";
  return `${(v * 100).toFixed(decimals)}%`;
}
function dppm(v: number | null) {
  if (v === null) return "N/A";
  return v === 0 ? "0" : v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function BacktestStage({ backtest, meta, onNext, onBack, hasDrift }: Props) {
  const { screens, has_ground_truth, yield_loss_by_lot } = backtest;
  const { pat, spec_only } = screens;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Backtest results</h2>
        <p className="text-sm text-ink-soft mt-1">
          PAT vs spec-only screening on holdout lots. The key question: how many{" "}
          <GlossaryChip id="maverick">mavericks</GlossaryChip> does each approach catch?
        </p>
      </div>

      {/* Head-to-head comparison */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* PAT */}
        <div className="rounded-xl border-2 border-brand bg-brand-tint p-5 space-y-4">
          <h3 className="font-semibold text-brand-deep">PAT screen</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">
                <GlossaryChip id="escape">Recall</GlossaryChip>
              </div>
              <div className="font-data text-2xl font-bold text-brand-deep">
                {has_ground_truth ? pct(pat.recall) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">
                <GlossaryChip id="dppm">Escape DPPM</GlossaryChip>
              </div>
              <div className="font-data text-2xl font-bold text-brand-deep">
                {has_ground_truth ? dppm(pat.escape_dppm) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">
                <GlossaryChip id="yield_loss">Yield loss</GlossaryChip>
              </div>
              <div className="font-data text-2xl font-bold text-ink">
                {pct(pat.yield_loss_overall)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">Over-kill (FP)</div>
              <div className="font-data text-2xl font-bold text-ink">{pat.fp.toLocaleString()}</div>
            </div>
          </div>
          {has_ground_truth && meta.by_construction && (
            <HonestyBadge type="by-construction" />
          )}
        </div>

        {/* Spec-only */}
        <div className="rounded-xl border border-border bg-white p-5 space-y-4">
          <h3 className="font-semibold text-ink">Spec-only screen</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">Recall</div>
              <div className={`font-data text-2xl font-bold ${has_ground_truth ? "text-not-capable" : "text-ink-soft"}`}>
                {has_ground_truth ? pct(spec_only.recall) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">Escape DPPM</div>
              <div className={`font-data text-2xl font-bold ${has_ground_truth && (spec_only.escape_dppm ?? 0) > 0 ? "text-not-capable" : "text-ink-soft"}`}>
                {has_ground_truth ? dppm(spec_only.escape_dppm) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">Yield loss</div>
              <div className="font-data text-2xl font-bold text-ink">
                {pct(spec_only.yield_loss_overall)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-wide mb-1">FP</div>
              <div className="font-data text-2xl font-bold text-ink">{spec_only.fp.toLocaleString()}</div>
            </div>
          </div>
          {!has_ground_truth && <HonestyBadge type="no-ground-truth" />}
        </div>
      </div>

      {/* Insight callout */}
      {has_ground_truth && (
        <div className="rounded-xl border border-brand/30 bg-brand-tint px-5 py-4 text-sm text-ink">
          <strong>Key insight:</strong> Parts were planted to pass the spec window but sit outside
          the PAT window. Spec-only screening catches <strong>0%</strong> of them.
          PAT catches <strong>100%</strong>. The cost is a small{" "}
          <GlossaryChip id="over_kill">over-kill</GlossaryChip> on stable lots
          and elevated over-kill on the drifted lot — examined in the next stage.
        </div>
      )}

      {/* Confusion matrices */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">PAT confusion matrix</h3>
          <ConfusionMatrix tp={pat.tp} fn={pat.fn} fp={pat.fp} tn={pat.tn} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">Spec-only confusion matrix</h3>
          <ConfusionMatrix tp={spec_only.tp} fn={spec_only.fn} fp={spec_only.fp} tn={spec_only.tn} />
        </div>
      </div>

      {/* Per-lot yield loss */}
      {yield_loss_by_lot.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">
            Yield loss by lot (PAT)
            {backtest.drift && (
              <span className="ml-2 text-xs text-ink-soft font-normal">
                Red bar: drifted lot ({backtest.drift.drifted_lot})
              </span>
            )}
          </h3>
          <YieldLossChart data={yield_loss_by_lot} height={180} />
          {meta.dataset_id === "stsawfd" && (
            <div className="mt-2 rounded-lg border border-border bg-surface-alt px-4 py-3 text-xs text-ink-soft">
              <HonestyBadge type="robustness" />{" "}
              <span className="ml-2">
                71% yield loss reflects the dataset&apos;s intrinsic failure rate, not a PAT quality
                result. All PAT limits were clamped to spec. This shows the pipeline ingests messy
                real data without breaking.
              </span>
            </div>
          )}
        </div>
      )}

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
          {hasDrift ? "Continue to Drift Spotlight" : "Continue to Takeaway"}
        </button>
      </div>
    </div>
  );
}
