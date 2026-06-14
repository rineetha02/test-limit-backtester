"use client";

import type { DatasetBundle } from "@/lib/types";
import { GlossaryChip } from "@/components/ui/GlossaryChip";
import { HonestyBadge } from "@/components/ui/HonestyBadge";
import { Printer, RotateCcw } from "lucide-react";

interface Props {
  bundle: DatasetBundle;
  onRestart: () => void;
  onBack: () => void;
}

export function TakeawayStage({ bundle, onRestart, onBack }: Props) {
  const { meta, backtest } = bundle;
  const { pat, spec_only } = backtest.screens;
  const hasGT = backtest.has_ground_truth;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Summary</h2>
        <p className="text-sm text-ink-soft mt-1">
          What this pipeline found on <strong>{meta.display_name}</strong>.
        </p>
      </div>

      {/* Key numbers */}
      <div className="rounded-2xl border-2 border-brand bg-brand-tint p-6 space-y-4">
        {hasGT ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="font-data text-3xl font-bold text-brand-deep">
                  {pat.recall !== null ? `${(pat.recall * 100).toFixed(0)}%` : "—"}
                </div>
                <div className="text-xs text-ink-soft mt-1">PAT recall</div>
              </div>
              <div>
                <div className="font-data text-3xl font-bold text-not-capable">
                  {spec_only.recall !== null ? `${(spec_only.recall * 100).toFixed(0)}%` : "—"}
                </div>
                <div className="text-xs text-ink-soft mt-1">Spec-only recall</div>
              </div>
              <div>
                <div className="font-data text-3xl font-bold text-brand-deep">
                  {pat.escape_dppm !== null ? (pat.escape_dppm === 0 ? "0" : pat.escape_dppm.toLocaleString()) : "—"}
                </div>
                <div className="text-xs text-ink-soft mt-1">PAT escape DPPM</div>
              </div>
              <div>
                <div className="font-data text-3xl font-bold text-not-capable">
                  {spec_only.escape_dppm !== null ? spec_only.escape_dppm.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                </div>
                <div className="text-xs text-ink-soft mt-1">Spec-only DPPM</div>
              </div>
            </div>
            {meta.by_construction && (
              <div className="text-center">
                <HonestyBadge type="by-construction" />
              </div>
            )}
          </>
        ) : (
          <div className="text-center space-y-2">
            <HonestyBadge type="no-ground-truth" />
            <p className="text-sm text-ink">
              {meta.dataset_id === "stsawfd"
                ? `Pipeline processed ${meta.parts_total.toLocaleString()} real parts across ${meta.lots_total.toLocaleString()} lots without errors.`
                : `Pipeline processed ${meta.parts_total.toLocaleString()} real parts across ${meta.lots_total.toLocaleString()} synthetic lots without errors.`}
            </p>
            <p className="font-data text-2xl font-bold text-ink">
              {(pat.yield_loss_overall * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-ink-soft">PAT yield loss</p>
          </div>
        )}
      </div>

      {/* What this shows */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">What this demonstrates</h3>
        <ul className="space-y-2 text-sm text-ink">
          {hasGT && (
            <>
              <li className="flex gap-2">
                <span className="text-brand mt-0.5">✓</span>
                <span>
                  <GlossaryChip id="pat">PAT</GlossaryChip> catches parts that pass the
                  datasheet spec but are statistical outliers. Spec-only screening cannot
                  catch them by construction.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand mt-0.5">✓</span>
                <span>
                  Small over-kill on stable lots (under 1.2%) is the cost of eliminating
                  latent <GlossaryChip id="escape">escapes</GlossaryChip>.
                </span>
              </li>
              {bundle.drift && (
                <li className="flex gap-2">
                  <span className="text-brand mt-0.5">✓</span>
                  <span>
                    Elevated over-kill on LOT10 ({(bundle.drift.lot10.yield_loss * 100).toFixed(1)}%)
                    is static PAT detecting a real process shift (+{bundle.drift.shift_mv} mV mean
                    drift). The right response is to investigate drift root cause and move to{" "}
                    <GlossaryChip id="dynamic_pat">dynamic PAT</GlossaryChip>.
                  </span>
                </li>
              )}
            </>
          )}
          {meta.dataset_id === "secom" && (
            <li className="flex gap-2">
              <span className="text-brand mt-0.5">✓</span>
              <span>
                Pipeline ingested a 591-feature real semiconductor dataset with missing values,
                selected 6 features, synthesized lot structure, and ran end-to-end without errors.
              </span>
            </li>
          )}
          {meta.dataset_id === "stsawfd" && (
            <>
              <li className="flex gap-2">
                <span className="text-brand mt-0.5">✓</span>
                <span>
                  Pipeline processed 126,794 real production parts across 1,156 lots with no
                  Python exceptions, correct JSON serialization of numpy types, and terminal output
                  capped to avoid floods.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 mt-0.5">!</span>
                <span>
                  71% yield loss is expected: the dataset&apos;s own intrinsic failure rate is very
                  high and PAT clamped to spec. Not a PAT quality result.{" "}
                  <HonestyBadge type="robustness" />
                </span>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Next step callout */}
      <div className="rounded-xl border border-brand/20 bg-surface-alt px-5 py-4">
        <h3 className="text-sm font-semibold text-ink mb-1">Next: dynamic PAT</h3>
        <p className="text-sm text-ink-soft">
          Static PAT sets limits once from reference lots and freezes them. As shown on LOT10,
          process drift raises over-kill. Dynamic PAT recomputes limits per lot, reducing false
          positives on drifted lots while maintaining escape DPPM near zero. The pipeline
          architecture supports this: each lot&apos;s median and robust sigma can be computed before
          screening begins.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-border text-sm text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
        >
          Back
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            data-no-print
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
          >
            <Printer size={14} />
            Print / save report
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-deep transition-colors"
          >
            <RotateCcw size={14} />
            Try another dataset
          </button>
        </div>
      </div>
    </div>
  );
}
