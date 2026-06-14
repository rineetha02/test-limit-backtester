export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  cpk: {
    term: "Cpk",
    definition:
      "Process capability index. min((USL - mean) / 3sigma, (mean - LSL) / 3sigma). Values above 1.33 are considered capable for automotive production.",
  },
  cp: {
    term: "Cp",
    definition:
      "Process capability ratio. (USL - LSL) / (6 sigma). Measures spread relative to spec width. Only defined for two-sided specs.",
  },
  pat: {
    term: "PAT",
    definition:
      "Part Average Testing (AEC-Q001). Statistical outlier screen that draws tighter limits inside the spec window to catch mavericks before they escape to the field.",
  },
  robust_sigma: {
    term: "Robust sigma",
    definition:
      "IQR / 1.35. The interquartile range divided by 1.35 estimates standard deviation without inflating due to outliers. Required by AEC-Q001.",
  },
  maverick: {
    term: "Maverick",
    definition:
      "A part that passes the datasheet spec window but sits far from its lot's statistical center. Mavericks are reliability-escape risks.",
  },
  escape: {
    term: "Escape",
    definition:
      "A reliability-risk part that passes screening and reaches the field. AEC-Q001 PAT targets latent escapes that spec-only testing cannot detect.",
  },
  dppm: {
    term: "DPPM",
    definition:
      "Defective Parts Per Million. false_negatives / parts_passing_screen x 1,000,000. The rate of latent defects that escape to the customer.",
  },
  yield_loss: {
    term: "Yield loss",
    definition:
      "Fraction of good parts rejected by the screen (over-kill). PAT's tighter limits cause some good parts near the edge to be discarded.",
  },
  over_kill: {
    term: "Over-kill",
    definition:
      "Good parts rejected by PAT. A small amount is acceptable; elevated over-kill on one lot signals a real process shift worth investigating.",
  },
  static_pat: {
    term: "Static PAT",
    definition:
      "PAT limits computed once from a reference population and applied frozen to all subsequent lots. Drift in later lots shows up as elevated over-kill.",
  },
  dynamic_pat: {
    term: "Dynamic PAT",
    definition:
      "PAT limits recomputed per-lot from that lot's own distribution. Avoids false over-kill on drifted lots but requires sufficient lot size to compute stable stats.",
  },
  aec_q001: {
    term: "AEC-Q001",
    definition:
      "Automotive Electronics Council standard Q001. Defines PAT methodology for automotive IC qualification, including the IQR/1.35 robust-sigma convention.",
  },
};
