"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { StepperNav, STAGES_BASE, STAGES_DRIFT } from "@/components/ui/StepperNav";
import { DatasetStage } from "@/components/stages/DatasetStage";
import { CapabilityStage } from "@/components/stages/CapabilityStage";
import { LimitsStage } from "@/components/stages/LimitsStage";
import { BacktestStage } from "@/components/stages/BacktestStage";
import { DriftStage } from "@/components/stages/DriftStage";
import { DynamicPatStage } from "@/components/stages/DynamicPatStage";
import { TakeawayStage } from "@/components/stages/TakeawayStage";
import { UploadFlow } from "@/components/upload/UploadFlow";
import { loadDataset } from "@/lib/dataLoader";
import type { DatasetId, DatasetBundle } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function AnalyzePage() {
  const [dataset, setDataset] = useState<DatasetId>("synthetic");
  const [stage, setStage] = useState(0);
  const [bundle, setBundle] = useState<DatasetBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadData = useCallback(async (id: DatasetId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDataset(id);
      setBundle(data);
    } catch (e) {
      setError(`Failed to load dataset: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(dataset);
  }, [dataset, loadData]);

  const hasDrift = bundle?.drift != null;
  // Drift flow: 0-Dataset 1-Capability 2-Limits 3-Backtest 4-Drift 5-DynamicPAT 6-Takeaway
  // Base flow:  0-Dataset 1-Capability 2-Limits 3-Backtest 4-Takeaway
  const maxStage = hasDrift ? 6 : 4;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" && stage < maxStage) setStage((s) => s + 1);
      if (e.key === "ArrowLeft" && stage > 0) setStage((s) => s - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, maxStage]);

  const handleDatasetChange = (id: DatasetId) => {
    setDataset(id);
    setStage(0);
    setBundle(null);
  };

  return (
    <>
      <TopBar dataset={dataset} onDatasetChange={handleDatasetChange} />
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-8">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8" data-no-print>
          <StepperNav
            current={stage}
            onSelect={setStage}
            stages={hasDrift ? STAGES_DRIFT : STAGES_BASE}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowUpload((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-brand cursor-pointer
                ${showUpload ? "border-brand bg-brand-tint text-brand-deep" : "border-border text-ink-soft hover:text-ink hover:border-ink-soft"}`}
            >
              {showUpload ? "Back to analysis" : "Upload your data"}
            </button>
          </div>
        </div>

        {showUpload ? (
          <UploadFlow />
        ) : loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-ink-soft">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading dataset...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : bundle ? (
          <>
            {stage === 0 && (
              <DatasetStage
                selected={dataset}
                onSelect={handleDatasetChange}
                onNext={() => setStage(1)}
              />
            )}
            {stage === 1 && (
              <CapabilityStage
                capability={bundle.capability}
                histograms={bundle.histograms}
                onNext={() => setStage(2)}
                onBack={() => setStage(0)}
              />
            )}
            {stage === 2 && (
              <LimitsStage
                limits={bundle.limits}
                histograms={bundle.histograms}
                onNext={() => setStage(3)}
                onBack={() => setStage(1)}
              />
            )}
            {stage === 3 && (
              <BacktestStage
                backtest={bundle.backtest}
                meta={bundle.meta}
                hasDrift={hasDrift}
                onNext={() => setStage(4)}
                onBack={() => setStage(2)}
              />
            )}
            {/* Drift flow stages */}
            {stage === 4 && hasDrift && bundle.drift && (
              <DriftStage
                drift={bundle.drift}
                onNext={() => setStage(5)}
                onBack={() => setStage(3)}
              />
            )}
            {stage === 5 && hasDrift && bundle.drift && (
              <DynamicPatStage
                drift={bundle.drift}
                onNext={() => setStage(6)}
                onBack={() => setStage(4)}
              />
            )}
            {stage === 6 && hasDrift && (
              <TakeawayStage
                bundle={bundle}
                onRestart={() => setStage(0)}
                onBack={() => setStage(5)}
              />
            )}
            {/* Base flow: stage 4 = Takeaway */}
            {stage === 4 && !hasDrift && (
              <TakeawayStage
                bundle={bundle}
                onRestart={() => setStage(0)}
                onBack={() => setStage(3)}
              />
            )}
          </>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
