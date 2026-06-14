import { Info } from "lucide-react";

interface Props {
  type: "by-construction" | "no-ground-truth" | "robustness";
  tooltip?: string;
}

const CONFIG = {
  "by-construction": {
    label: "By construction",
    color: "bg-blue-50 text-blue-800 border-blue-200",
    tip: "Mavericks were planted to sit between PAT and spec limits. Catching 100% demonstrates the mechanism, it is not a discovery.",
  },
  "no-ground-truth": {
    label: "No ground truth",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    tip: "No maverick labels in this dataset. Recall and escape DPPM cannot be computed. Capability and yield loss only.",
  },
  robustness: {
    label: "Real-world data",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    tip: "High yield loss reflects the dataset's intrinsic failure rate, not a PAT quality result. Shows the pipeline generalizes to messy real data.",
  },
};

export function HonestyBadge({ type, tooltip }: Props) {
  const cfg = CONFIG[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}
      title={tooltip ?? cfg.tip}
    >
      <Info size={11} />
      {cfg.label}
    </span>
  );
}
