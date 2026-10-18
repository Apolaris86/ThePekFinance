"use client";

export interface Slice {
  label: string;
  value: number;
}

// Categorical palette, distinguishable in light and dark themes.
const COLORS = ["#1a73e8", "#e8710a", "#12b5cb", "#d01884", "#7cb342", "#9334e6", "#f9ab00", "#5f6368"];

/** Allocation donut with a legend. Slices beyond 7 are folded into "Other". */
export function Donut({ slices, format }: { slices: Slice[]; format: (v: number) => string }) {
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const shown = sorted.length > 8 ? [...sorted.slice(0, 7), { label: "Other", value: sorted.slice(7).reduce((s, x) => s + x.value, 0) }] : sorted;
  const total = shown.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;

  const r = 40;
  const circ = 2 * Math.PI * r;
  const lengths = shown.map((s) => (s.value / total) * circ);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="Portfolio allocation">
        {shown.map((s, i) => (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${Math.max(lengths[i] - 0.6, 0)} ${circ}`}
              strokeDashoffset={-offsets[i]}
            >
              <title>{`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}</title>
            </circle>
        ))}
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {shown.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="tabular text-muted">{format(s.value)}</span>
            <span className="tabular w-14 text-right font-medium">{((s.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
