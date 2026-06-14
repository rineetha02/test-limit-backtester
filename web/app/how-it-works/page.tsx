import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { ArrowRight } from "lucide-react";

export default function HowItWorks() {
  return (
    <>
      <TopBar />
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold text-ink mb-2">How it works</h1>
        <p className="text-ink-soft mb-10">
          A plain explanation of what the pipeline does, why each step exists, and what the
          numbers mean.
        </p>

        <div className="space-y-10 text-sm text-ink leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">The problem</h2>
            <p>
              Datasheet specs define a pass window: if a part measures between the lower and upper
              spec limit, it ships. That window is set for function, not reliability. Some parts
              sit just inside the edge of the window and are statistical oddballs compared to their
              lot peers. Those oddballs, called mavericks, tend to fail in the field at elevated
              rates even though they pass the spec test.
            </p>
            <p className="mt-3">
              Spec-only screening cannot catch mavericks by definition: they pass spec. The only way
              to catch them is to compare each part to the statistical distribution of its lot and
              flag those that sit unusually far from the center.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">Part Average Testing (PAT)</h2>
            <p>
              AEC-Q001 defines PAT as a way to draw tighter, statistical limits inside the spec
              window. The limits are computed from a reference population of known-good parts, using
              robust statistics so that a few outliers do not inflate the sigma estimate.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-surface-alt p-4 space-y-2">
              <div className="font-semibold text-xs uppercase tracking-wide text-ink-soft">Key formulas</div>
              <div className="font-data text-xs space-y-1 text-ink">
                <p>Robust sigma = IQR / 1.35</p>
                <p>PAT upper = robust median + N x robust sigma (clamped to spec USL)</p>
                <p>PAT lower = robust median - N x robust sigma (clamped to spec LSL)</p>
                <p>Cp = (USL - LSL) / (6 x sigma), two-sided only</p>
                <p>Cpk = min((USL - mean) / (3 sigma), (mean - LSL) / (3 sigma))</p>
                <p>Escape DPPM = false negatives / parts passing screen x 1,000,000</p>
              </div>
            </div>
            <p className="mt-3">
              N = 6 is the default multiplier (conservative, suitable for automotive). The IQR / 1.35
              formula gives a standard deviation estimate that is resistant to the outliers PAT is
              trying to catch. If you used regular sigma, the outliers would inflate the estimate and
              widen the very limits meant to catch them.
            </p>
            <p className="mt-3">
              Two-sided PAT limits are applied even to parameters with one-sided datasheet specs
              (such as a noise floor with only a USL). PAT is a reliability screen for statistical
              anomalies in either direction, independent of which direction the datasheet limit
              covers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">How the backtest works</h2>
            <p>
              The pipeline splits data into reference lots (used to compute limits) and holdout lots
              (used to evaluate them). The backtest applies PAT and spec-only screening to the holdout
              lots and computes a confusion matrix for each.
            </p>
            <p className="mt-3">
              For the synthetic dataset, mavericks are planted with ground-truth labels so the
              confusion matrix is exact. For real datasets (SECOM, ST-AWFD), no maverick labels exist,
              so only yield loss is reported.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-3 py-2 font-medium text-ink-soft">Term</th>
                    <th className="text-left px-3 py-2 font-medium text-ink-soft">Definition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["True positive (TP)", "Latent defect caught by screening (good)."],
                    ["False negative (FN)", "Latent defect that escaped screening (bad)."],
                    ["False positive (FP)", "Good part rejected by screening (yield loss, over-kill)."],
                    ["True negative (TN)", "Good part correctly passed."],
                    ["Recall", "TP / (TP + FN). Fraction of latent defects caught."],
                    ["Escape DPPM", "FN / parts_passing_screen x 1,000,000."],
                    ["Yield loss", "FP / (total parts - true defects). Cost of screening."],
                  ].map(([term, def]) => (
                    <tr key={term}>
                      <td className="px-3 py-2 font-data font-semibold text-ink whitespace-nowrap">{term}</td>
                      <td className="px-3 py-2 text-ink-soft">{def}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">Static vs dynamic PAT</h2>
            <p>
              Static PAT computes limits once from a reference population and applies them frozen to
              all subsequent lots. This is easy to implement but has a known failure mode: if the
              process drifts, parts that were on the edge of the PAT window in reference lots may now
              sit well inside (or outside) it. The demo shows LOT10 with a +4.4 mV offset_voltage
              drift. The static PAT limits flag 6.42% of that lot as over-kill, compared to under 1%
              on stable lots.
            </p>
            <p className="mt-3">
              The elevated over-kill is the detection signal: it tells a process engineer that
              something changed. Dynamic PAT recomputes limits per lot, reducing false positives on
              drifted lots while keeping escape DPPM near zero. The pipeline architecture supports
              this: per-lot median and robust sigma can be computed before screening begins.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">Pipeline structure</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-3 py-2 font-medium text-ink-soft">Script</th>
                    <th className="text-left px-3 py-2 font-medium text-ink-soft">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["generate_synthetic_data.py", "10 lots, 1,000 parts each, with planted mavericks and spec failures in separate non-overlapping columns."],
                    ["profile_tests.py", "Cp and Cpk with robust sigma from reference lots."],
                    ["propose_limits.py", "PAT limits (robust median +/- N sigma, clamped) and Cpk-target limits."],
                    ["backtest.py", "Confusion matrix, recall, escape DPPM, and yield loss against holdout lots."],
                    ["make_report.py", "Markdown + HTML report with per-parameter histograms."],
                    ["adapt_secom.py / adapt_stsawfd.py", "Adapters that map public real datasets into the pipeline schema."],
                  ].map(([script, desc]) => (
                    <tr key={script}>
                      <td className="px-3 py-2 font-data text-ink whitespace-nowrap">{script}</td>
                      <td className="px-3 py-2 text-ink-soft">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">Honesty notes</h2>
            <ul className="space-y-2 list-disc list-inside text-ink-soft">
              <li>
                <strong className="text-ink">100% recall is by construction.</strong> Mavericks were
                planted to sit between PAT and spec limits, so PAT must catch them. This demonstrates
                the mechanism, not a discovery.
              </li>
              <li>
                <strong className="text-ink">SECOM and ST-AWFD have no maverick labels.</strong> Only
                capability and yield loss are reported. Recall and escape DPPM are not shown.
              </li>
              <li>
                <strong className="text-ink">ST-AWFD 71% yield loss is a robustness demo,</strong> not
                a quality result. The dataset has a very high intrinsic failure rate and all PAT
                limits were clamped to spec.
              </li>
              <li>
                <strong className="text-ink">LOT10 over-kill (6.42%) is the drift signal,</strong> not
                a bug. Static PAT correctly detected a process shift.
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex justify-center">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand text-white font-semibold text-sm hover:bg-brand-deep transition-colors"
          >
            Run the demo
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
