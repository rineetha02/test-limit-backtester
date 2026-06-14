"use client";

import type { DatasetId, DatasetMeta } from "@/lib/types";
import { HonestyBadge } from "@/components/ui/HonestyBadge";
import { CheckCircle } from "lucide-react";

const DATASETS: {
  id: DatasetId;
  name: string;
  subtitle: string;
  source: string;
  source_url: string | null;
  has_ground_truth: boolean;
  by_construction: boolean;
  badge?: "by-construction" | "no-ground-truth" | "robustness";
}[] = [
  {
    id: "synthetic",
    name: "Synthetic TMR Current Sensor",
    subtitle: "10 lots, 1,000 parts each, planted mavericks",
    source: "Generated, seed=42",
    source_url: null,
    has_ground_truth: true,
    by_construction: true,
    badge: "by-construction",
  },
  {
    id: "secom",
    name: "SECOM (UCI ML Repository)",
    subtitle: "1,567 parts, 32 synthetic lots",
    source: "UCI Machine Learning Repository",
    source_url: "https://archive.ics.uci.edu/dataset/179/secom",
    has_ground_truth: false,
    by_construction: false,
    badge: "no-ground-truth",
  },
  {
    id: "stsawfd",
    name: "ST-AWFD D2 (STMicroelectronics)",
    subtitle: "126,794 parts, 1,156 lots",
    source: "STMicroelectronics GitHub",
    source_url: "https://github.com/STMicroelectronics/ST-AWFD",
    has_ground_truth: false,
    by_construction: false,
    badge: "robustness",
  },
];

interface Props {
  selected: DatasetId;
  onSelect: (id: DatasetId) => void;
  onNext: () => void;
}

export function DatasetStage({ selected, onSelect, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Choose a dataset</h2>
        <p className="text-sm text-ink-soft mt-1">
          The synthetic dataset has planted mavericks and ground-truth labels. The real datasets
          test pipeline robustness on production data without ground truth.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {DATASETS.map((ds) => {
          const active = ds.id === selected;
          return (
            <button
              key={ds.id}
              type="button"
              onClick={() => onSelect(ds.id)}
              className={`text-left rounded-xl border p-4 transition-all focus-visible:outline-2 focus-visible:outline-brand cursor-pointer
                ${active ? "border-brand bg-brand-tint shadow-sm" : "border-border bg-white hover:border-brand/50 hover:bg-surface-alt"}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-medium text-sm text-ink leading-snug">{ds.name}</span>
                {active && <CheckCircle size={16} className="text-brand flex-shrink-0 mt-0.5" />}
              </div>
              <p className="text-xs text-ink-soft mb-2">{ds.subtitle}</p>
              {ds.source_url ? (
                <a
                  href={ds.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-deep underline underline-offset-2 hover:text-brand"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ds.source}
                </a>
              ) : (
                <span className="text-xs text-ink-soft">{ds.source}</span>
              )}
              {ds.badge && (
                <div className="mt-2">
                  <HonestyBadge type={ds.badge} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-deep transition-colors focus-visible:outline-2 focus-visible:outline-brand"
        >
          Continue to Capability
        </button>
      </div>
    </div>
  );
}
