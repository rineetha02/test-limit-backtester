interface Props {
  tp: number | null;
  fn: number | null;
  fp: number;
  tn: number;
}

function Cell({ value, label, color }: { value: number | null; label: string; color: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-lg ${color}`}>
      <span className="font-data text-2xl font-bold">{value !== null ? value.toLocaleString() : "N/A"}</span>
      <span className="text-xs font-medium mt-1 text-center leading-tight">{label}</span>
    </div>
  );
}

export function ConfusionMatrix({ tp, fn, fp, tn }: Props) {
  const hasGT = tp !== null && fn !== null;
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-1 text-center">
        <div className="text-xs font-medium text-ink-soft py-1">Predicted: Fail</div>
        <div className="text-xs font-medium text-ink-soft py-1">Predicted: Pass</div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Cell
          value={tp}
          label={hasGT ? "True positive\n(caught defect)" : "—"}
          color={hasGT && tp !== null && tp > 0 ? "bg-brand-tint text-brand-deep" : "bg-surface-alt text-ink-soft"}
        />
        <Cell
          value={fn}
          label={hasGT ? "False negative\n(escape)" : "—"}
          color={hasGT && fn !== null && fn > 0 ? "bg-red-50 text-red-800" : "bg-surface-alt text-ink-soft"}
        />
        <Cell
          value={fp}
          label="False positive\n(over-kill)"
          color={fp > 0 ? "bg-amber-50 text-amber-800" : "bg-surface-alt text-ink-soft"}
        />
        <Cell
          value={tn}
          label="True negative\n(correct pass)"
          color="bg-surface-alt text-ink-soft"
        />
      </div>
      {!hasGT && (
        <p className="text-xs text-ink-soft mt-2">
          No <code>true_latent_fail</code> ground truth. TP and FN cannot be computed.
        </p>
      )}
    </div>
  );
}
