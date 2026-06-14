"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitFork } from "lucide-react";
import type { DatasetId } from "@/lib/types";

const DATASETS: { id: DatasetId; label: string }[] = [
  { id: "synthetic", label: "Synthetic" },
  { id: "secom", label: "SECOM" },
  { id: "stsawfd", label: "ST-AWFD" },
];

interface Props {
  dataset?: DatasetId;
  onDatasetChange?: (id: DatasetId) => void;
}

export function TopBar({ dataset, onDatasetChange }: Props) {
  const path = usePathname();
  const isAnalyze = path?.startsWith("/analyze");

  return (
    <nav className="sticky top-0 z-40 bg-nav" role="navigation" aria-label="Main navigation">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Wordmark */}
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span className="font-bold text-white text-base leading-none">
            Test Limit Backtester
          </span>
          <span className="text-xs text-white/50 hidden sm:inline">AEC-Q001 PAT Analysis</span>
        </Link>

        <div className="flex items-center gap-4 ml-auto">
          {/* Dataset switcher — only in analyze */}
          {isAnalyze && dataset && onDatasetChange && (
            <div
              className="hidden sm:flex items-center rounded-lg border border-white/20 bg-white/10 p-0.5 gap-0.5"
              role="group"
              aria-label="Dataset"
            >
              {DATASETS.map((ds) => (
                <button
                  key={ds.id}
                  type="button"
                  onClick={() => onDatasetChange(ds.id)}
                  aria-pressed={dataset === ds.id}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand cursor-pointer
                    ${dataset === ds.id ? "bg-white shadow text-nav" : "text-white/70 hover:text-white"}`}
                >
                  {ds.label}
                </button>
              ))}
            </div>
          )}

          <Link
            href="/how-it-works"
            className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block"
          >
            How it works
          </Link>

          <a
            href="https://github.com/rineetha02/test-limit-backtester"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-white/50 hover:text-white transition-colors"
          >
            <GitFork size={18} />
          </a>
        </div>
      </div>
    </nav>
  );
}
