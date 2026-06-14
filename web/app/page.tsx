import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { ArrowRight, ShieldCheck, TrendingUp, Zap } from "lucide-react";

export default function Home() {
  return (
    <>
      <TopBar />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 pt-16 pb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-ink tracking-tight leading-tight">
            Find the reliability escapes
            <br className="hidden sm:block" />
            <span className="text-brand"> your spec limits miss.</span>
          </h1>
          <p className="mt-4 text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Automates AEC-Q001 Part Average Testing: computes PAT limits from reference lots,
            backtests against holdout lots, and shows exactly how many mavericks spec-only
            screening would have let escape.
          </p>

          {/* Hero stats */}
          <div className="mt-8 inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-8 rounded-2xl border-2 border-brand bg-brand-tint px-6 sm:px-10 py-5">
            <div className="text-center">
              <div className="font-data text-4xl font-bold text-brand-deep">0</div>
              <div className="text-sm text-ink-soft mt-1">escape DPPM with PAT</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-brand/30" />
            <div className="text-center">
              <div className="font-data text-4xl font-bold text-not-capable">14,832</div>
              <div className="text-sm text-ink-soft mt-1">escape DPPM with spec-only</div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand text-white font-semibold text-sm hover:bg-brand-deep transition-colors focus-visible:outline-2 focus-visible:outline-brand"
            >
              Run the demo
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-ink text-sm font-medium hover:border-ink-soft hover:bg-surface-alt transition-colors"
            >
              How it works
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-soft">No sign-up. No install. Runs in the browser.</p>
        </section>

        {/* Feature row */}
        <section className="border-t border-border bg-surface-alt">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 grid gap-8 sm:grid-cols-3">
            <div className="space-y-2">
              <ShieldCheck size={22} className="text-brand" />
              <h3 className="font-semibold text-ink">AEC-Q001 math</h3>
              <p className="text-sm text-ink-soft leading-relaxed">
                Robust sigma = IQR / 1.35. PAT limits at robust median +/- 6 sigma, clamped to spec.
                Cp and Cpk using the same convention your lab uses.
              </p>
            </div>
            <div className="space-y-2">
              <TrendingUp size={22} className="text-brand" />
              <h3 className="font-semibold text-ink">Drift detection built in</h3>
              <p className="text-sm text-ink-soft leading-relaxed">
                Static PAT limits correctly flag drifted lots as elevated over-kill. The signal
                that motivates moving from static to dynamic per-lot PAT.
              </p>
            </div>
            <div className="space-y-2">
              <Zap size={22} className="text-brand" />
              <h3 className="font-semibold text-ink">Real data tested</h3>
              <p className="text-sm text-ink-soft leading-relaxed">
                Verified on UCI SECOM (1,567 parts) and STMicro ST-AWFD D2 (126,794 parts, 1,156 lots)
                without modification.
              </p>
            </div>
          </div>
        </section>

        {/* Results snapshot */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
          <h2 className="text-xl font-semibold text-ink mb-6">
            Synthetic TMR sensor results (seed=42)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-soft uppercase tracking-wide">Metric</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-brand uppercase tracking-wide">PAT</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-ink-soft uppercase tracking-wide">Spec-only</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 text-ink">Recall on planted mavericks</td>
                  <td className="px-4 py-3 text-right font-data font-bold text-brand-deep">100%</td>
                  <td className="px-4 py-3 text-right font-data text-not-capable">0%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-ink">Escape DPPM</td>
                  <td className="px-4 py-3 text-right font-data font-bold text-brand-deep">0</td>
                  <td className="px-4 py-3 text-right font-data text-not-capable">14,832</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-ink">Yield loss (stable lots)</td>
                  <td className="px-4 py-3 text-right font-data">0.41 to 1.11%</td>
                  <td className="px-4 py-3 text-right font-data text-ink-soft">—</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-ink">Yield loss (LOT10, drifted)</td>
                  <td className="px-4 py-3 text-right font-data text-not-capable font-bold">6.42%</td>
                  <td className="px-4 py-3 text-right font-data text-ink-soft">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            The 6.42% yield loss on LOT10 is static PAT correctly detecting a +4.4 mV process drift, not a false alarm.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand text-white font-semibold text-sm hover:bg-brand-deep transition-colors"
            >
              Explore the full breakdown
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
