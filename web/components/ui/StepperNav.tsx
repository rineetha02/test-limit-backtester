"use client";

import { Check } from "lucide-react";

export const STAGES_BASE = [
  { id: 0, label: "Dataset" },
  { id: 1, label: "Capability" },
  { id: 2, label: "Limits" },
  { id: 3, label: "Backtest" },
  { id: 4, label: "Takeaway" },
] as const;

export const STAGES_DRIFT = [
  { id: 0, label: "Dataset" },
  { id: 1, label: "Capability" },
  { id: 2, label: "Limits" },
  { id: 3, label: "Backtest" },
  { id: 4, label: "Drift" },
  { id: 5, label: "Dynamic" },
  { id: 6, label: "Takeaway" },
] as const;

interface StageEntry {
  id: number;
  label: string;
}

interface Props {
  current: number;
  onSelect: (idx: number) => void;
  stages?: readonly StageEntry[];
}

export function StepperNav({ current, onSelect, stages = STAGES_BASE }: Props) {
  return (
    <nav aria-label="Analysis stages" className="flex items-center gap-0">
      {stages.map((stage, i) => {
        const done = stage.id < current;
        const active = stage.id === current;
        return (
          <div key={stage.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect(stage.id)}
              aria-current={active ? "step" : undefined}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-brand
                ${active ? "text-brand-deep" : done ? "text-brand cursor-pointer hover:text-brand-deep" : "text-ink-soft cursor-pointer hover:text-ink"}`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                  ${active ? "border-brand bg-brand text-white" : done ? "border-brand bg-brand-tint text-brand-deep" : "border-border bg-surface text-ink-soft"}`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : stage.id + 1}
              </span>
              <span className="text-xs font-medium whitespace-nowrap hidden sm:block">{stage.label}</span>
            </button>
            {i < stages.length - 1 && (
              <div
                className={`h-px w-6 flex-shrink-0 ${stage.id < current ? "bg-brand" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
