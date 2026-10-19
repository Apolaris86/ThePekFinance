"use client";

import { useQuery } from "@tanstack/react-query";
import {
  historyRangeFor,
  lotsPeriodChange,
  periodBaseline,
  type ChartRange,
  type GainPeriod,
  type PeriodChange,
  type Position,
  type Quote,
} from "@pek/shared";
import { api } from "./queries";

/** Daily history for a set of symbols in one request; shared by the value chart and the period gains. */
export function useHistories(symbols: string[], range: ChartRange | null) {
  const sorted = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: ["histories", sorted.join(","), range],
    queryFn: () => api.histories(sorted, range!),
    enabled: !!range && sorted.length > 0,
    staleTime: 60 * 60_000,
  });
}

/** Each position's change over the period, keyed by symbol. */
export function usePeriodChanges(positions: Position[], quotes: Record<string, Quote>, period: GainPeriod) {
  const range = historyRangeFor(period);
  const histories = useHistories(
    positions.map((p) => p.symbol),
    range,
  );
  const changes: Record<string, PeriodChange> = {};
  for (const p of positions) {
    const q = quotes[p.symbol];
    const baseline = q && periodBaseline(period, q, histories.data?.[p.symbol]);
    if (baseline) changes[p.symbol] = lotsPeriodChange(p.lots, q.price, baseline);
  }
  return { changes, loading: !!range && histories.isPending };
}
