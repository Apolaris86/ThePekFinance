import type { Candle } from "@pek/shared";

/** Tiny line chart; green/red against `baseline` (previous close) when given, else the first point. */
export function Sparkline({ candles, baseline, className = "h-10 w-full" }: { candles: Candle[]; baseline?: number; className?: string }) {
  if (candles.length < 2) return <div className={className} />;
  const closes = candles.map((c) => c.close);
  const ref = baseline ?? closes[0];
  const min = Math.min(...closes, ref);
  const max = Math.max(...closes, ref);
  const span = max - min || 1;
  const W = 100;
  const H = 32;
  const y = (v: number) => H - ((v - min) / span) * (H - 2) - 1;
  const points = closes.map((v, i) => `${((i / (closes.length - 1)) * W).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const up = closes[closes.length - 1] >= ref;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      {baseline != null && (
        <line x1="0" x2={W} y1={y(baseline)} y2={y(baseline)} stroke="var(--muted)" strokeWidth="0.6" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      )}
      <polyline points={points} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
