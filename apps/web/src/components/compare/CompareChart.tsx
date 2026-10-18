"use client";

import { useEffect, useRef } from "react";
import { createChart, CrosshairMode, LineSeries, LineStyle, type Time, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@pek/shared";

export interface CompareSeries {
  symbol: string;
  color: string;
  candles: Candle[];
}

const DAY = 86_400;

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Daily closes as % change from each series' first point. Timestamps are snapped
 * to the UTC day so US, SGX and Paris closes for the same date line up.
 */
export function toPercentSeries(candles: Candle[]) {
  if (candles.length === 0) return [];
  const base = candles[0].close;
  const byDay = new Map<number, number>();
  for (const c of candles) byDay.set(Math.floor(c.time / DAY) * DAY, ((c.close - base) / base) * 100);
  return [...byDay.entries()].map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

export function CompareChart({ series }: { series: CompareSeries[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const muted = cssVar("--muted");
    const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: muted, attributionLogo: false, fontFamily: "inherit" },
      grid: { vertLines: { visible: false }, horzLines: { color: cssVar("--border") } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        priceFormatter: (p: number) => `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`,
        timeFormatter: (t: Time) => dateFmt.format(new Date((t as number) * 1000)),
      },
      handleScroll: false,
      handleScale: false,
    });
    series.forEach((s, i) => {
      const line = chart.addSeries(LineSeries, { color: s.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: s.symbol });
      line.setData(toPercentSeries(s.candles));
      if (i === 0) line.createPriceLine({ price: 0, color: muted, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series]);

  return <div ref={ref} className="h-80 w-full sm:h-96" />;
}
