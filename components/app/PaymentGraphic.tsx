import { cx } from "@/utils/cx";

const tones = {
  paid: { halo: "fill-accent-50", badge: "fill-accent-600" },
  failed: { halo: "fill-status-rose-background", badge: "fill-status-rose-text" },
  checking: { halo: "fill-status-yellow-background", badge: "fill-status-yellow-text" },
} as const;
const marks = { paid: "M122 100l8.5 8.5L146 92", failed: "M125 91l18 18M143 91l-18 18", checking: "M134 87v13l9 6" } as const;
const rows = [["M82 70h36", 260], ["M82 81h36", 320], ["M82 92h22", 380]] as const;
const sparks = [0, 45, 90, 135, 180, 225];

// A pulse moves from payer to institute while the result is confirmed. It never implies success.
export function PaymentTransfer() {
  return <svg className="pay-transfer" viewBox="0 0 120 24" width="120" height="24" fill="none" aria-hidden="true">
    <path className="stroke-border-button-default" strokeWidth="2" strokeLinecap="round" d="M12 12h96" />
    <circle className="fill-accent-700" cx="12" cy="12" r="5" /><circle className="fill-accent-700" cx="108" cy="12" r="5" />
    <circle className="pt-pulse fill-accent-500" cx="12" cy="12" r="3.5" />
  </svg>;
}

// A receipt prints, then its badge lands. Plain SVG and CSS, so parent routes ship no animation library.
export function PaymentGraphic({ kind }: { kind: keyof typeof tones }) {
  const tone = tones[kind];
  return <svg className="pay-graphic" viewBox="0 0 200 150" width="168" height="126" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-kind={kind}>
    <circle className={cx("pg-halo", tone.halo)} cx="100" cy="75" r="66" />
    <g className="pg-receipt">
      <path className="fill-background-primary-default stroke-border-button-default" strokeWidth="2" d="M74 14h52a6 6 0 0 1 6 6v98l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6V20a6 6 0 0 1 6-6z" />
      <path className="stroke-accent-600" strokeWidth="3" d="M90 28h20M90 35h20M97 28c6 0 9 3 9 7s-4 8-9 8h-7l15 14" />
      {rows.map(([d, delay]) => <path key={d} className="pg-draw stroke-border-button-default" strokeWidth="3" pathLength={1} d={d} style={{ animationDelay: `${delay}ms` }} />)}
    </g>
    <g className="pg-badge">
      <circle className={cx(tone.badge, "stroke-background-primary-default")} strokeWidth="4" cx="134" cy="100" r="24" />
      <path className="pg-draw stroke-background-primary-default" strokeWidth="4.5" pathLength={1} d={marks[kind]} style={{ animationDelay: "640ms" }} />
    </g>
    {kind === "paid" ? sparks.map((angle, index) => <g key={angle} transform={`rotate(${angle} 134 100)`}><path className={cx("pg-spark", index % 2 ? "stroke-status-lime-text" : "stroke-accent-500")} strokeWidth="3" d="M134 70v-8" /></g>) : null}
  </svg>;
}
