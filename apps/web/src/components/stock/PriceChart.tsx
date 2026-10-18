"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  createChart,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, ChartRange, Currency } from "@pek/shared";
import { formatPrice } from "@/lib/format";

interface Props {
  candles: Candle[];
  range: ChartRange;
  currency: Currency;
  timezone: string;
  /** previous close, drawn as a dashed line on the 1D chart */
  baseline?: number;
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Re-render when the OS colour scheme flips so the chart picks up new tokens. */
function useColorScheme() {
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setScheme(mq.matches ? "dark" : "light");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return scheme;
}

export function PriceChart({ candles, range, currency, timezone, baseline }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scheme = useColorScheme();

  useEffect(() => {
    const el = ref.current;
    if (!el || candles.length === 0) return;

    const intraday = range === "1D" || range === "5D";
    const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...opts });
    const timeFmt = fmt({ hour: "numeric", minute: "2-digit" });
    const dayFmt = fmt({ month: "short", day: "numeric" });
    const monthFmt = fmt({ month: "short" });
    const yearFmt = fmt({ year: "numeric" });
    const crosshairFmt = intraday
      ? fmt({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : fmt({ month: "short", day: "numeric", year: "numeric" });
    const toDate = (t: Time) => new Date((t as number) * 1000);

    const first = baseline ?? candles[0].close;
    const last = candles[candles.length - 1].close;
    const color = cssVar(last >= first ? "--up" : "--down");
    const muted = cssVar("--muted");
    const border = cssVar("--border");

    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: muted, attributionLogo: false, fontFamily: "inherit" },
      grid: { vertLines: { visible: false }, horzLines: { color: border } },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: intraday,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (t: Time, type: TickMarkType) => {
          const d = toDate(t);
          if (type === TickMarkType.Year) return yearFmt.format(d);
          if (type === TickMarkType.Month) return monthFmt.format(d);
          if (type === TickMarkType.DayOfMonth) return dayFmt.format(d);
          return timeFmt.format(d);
        },
      },
      crosshair: { mode: CrosshairMode.Magnet, vertLine: { labelBackgroundColor: muted }, horzLine: { labelBackgroundColor: muted } },
      localization: {
        timeFormatter: (t: Time) => crosshairFmt.format(toDate(t)),
        priceFormatter: (p: number) => formatPrice(p, currency),
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      lineWidth: 2,
      topColor: `${color}40`,
      bottomColor: `${color}00`,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    series.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));

    if (range === "1D" && baseline != null) {
      series.createPriceLine({
        price: baseline,
        color: muted,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Prev close",
      });
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, range, currency, timezone, baseline, scheme]);

  return <div ref={ref} className="h-72 w-full sm:h-80" />;
}
