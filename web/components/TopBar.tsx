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
  const isDemo = path?.startsWith("/demo");

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-sm" role="navigation" aria-label="Main navigation">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Wordmark */}
        <Link href="/" className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-semibold text-brand text-base leading-none">
            Test Limit Backtester
          </span>
          <span className="text-xs text-ink-soft hidden sm:inline">for Allegro MicroSystems</span>
        </Link>

        <div className="flex items-center gap-4 ml-auto">
          {/* Dataset switcher — only in demo */}
          {isDemo && dataset && onDatasetChange && (
            <div
              className="hidden sm:flex items-center rounded-lg border border-border bg-surface-alt p-0.5 gap-0.5"
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
                    ${dataset === ds.id ? "bg-white shadow text-ink" : "text-ink-soft hover:text-ink"}`}
                >
                  {ds.label}
                </button>
              ))}
            </div>
          )}

          <Link
            href="/how-it-works"
            className="text-sm text-ink-soft hover:text-ink transition-colors hidden sm:block"
          >
            How it works
          </Link>

          <a
            href="https://github.com/rvg/test-limit-backtester"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-ink-soft hover:text-ink transition-colors"
          >
            <GitFork size={18} />
          </a>
        </div>
      </div>
    </nav>
  );
}
