interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  alert?: boolean;
}

export function MetricCard({ label, value, sub, accent, alert }: Props) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-1 ${
        accent
          ? "border-brand bg-brand-tint"
          : alert
          ? "border-not-capable bg-red-50"
          : "border-border bg-white"
      }`}
    >
      <span className="text-xs font-medium text-ink-soft uppercase tracking-wide">{label}</span>
      <span
        className={`font-data text-3xl font-bold tracking-tight ${
          accent ? "text-brand-deep" : alert ? "text-not-capable" : "text-ink"
        }`}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-ink-soft">{sub}</span>}
    </div>
  );
}
