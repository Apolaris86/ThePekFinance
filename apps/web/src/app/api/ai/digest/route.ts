import { getBaseCurrency, groupLots, listHoldings, summarize, valueHolding, convert } from "@pek/shared";
import { digestPortfolio } from "@/server/ai";
import { headlineList, respondAi } from "@/server/ai-http";
import { requireUser } from "@/server/auth";
import { getFxRates, getNews, getQuotes } from "@/server/data";

const NEWS_FOR_TOP = 5;

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  // Reads go through the user's own Supabase session, so RLS scopes them.
  const portfolioId = new URL(req.url).searchParams.get("portfolio");
  const [allLots, base] = await Promise.all([listHoldings(auth.supabase), getBaseCurrency(auth.supabase)]);
  const lots = portfolioId ? allLots.filter((l) => l.portfolioId === portfolioId) : allLots;
  if (lots.length === 0) return Response.json({ error: "Add holdings to get a digest" }, { status: 400 });

  const positions = groupLots(lots);
  const [quotes, fx] = await Promise.all([getQuotes(positions.map((p) => p.symbol).sort()), getFxRates()]);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const valuations = positions.flatMap((p) => {
    const q = bySymbol.get(p.symbol);
    return q ? [{ v: valueHolding(p, q.price, q.previousClose), q }] : [];
  });
  const total = summarize(valuations.map((x) => x.v), base, fx);
  const ranked = [...valuations].sort(
    (a, b) => convert(b.v.marketValue, b.v.holding.currency, base, fx) - convert(a.v.marketValue, a.v.holding.currency, base, fx),
  );
  const news = await Promise.all(ranked.slice(0, NEWS_FOR_TOP).map(({ q }) => getNews(q.symbol).catch(() => [])));

  const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  const input = [
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `Each position shows its last trade date; a move dated before today belongs to that earlier session, not today.`,
    `Portfolio value: ${total.marketValue.toFixed(0)} ${base}; latest sessions ${pct((total.dayChange / (total.marketValue - total.dayChange || 1)) * 100)}; total gain ${pct(total.gainPercent)}`,
    `Positions (largest first):`,
    ...ranked.map(({ v, q }) => {
      const weight = (convert(v.marketValue, v.holding.currency, base, fx) / (total.marketValue || 1)) * 100;
      const asOf = new Date(q.timestamp).toISOString().slice(0, 10);
      return `- ${q.symbol} ${q.name ?? ""}: ${weight.toFixed(1)}% of portfolio, last session (${asOf}) ${pct(q.changePercent)}, total gain ${pct(v.gainPercent)}`;
    }),
    ``,
    ...ranked.slice(0, NEWS_FOR_TOP).map(({ q }, i) => `Headlines for ${q.symbol}:\n${headlineList(news[i], 3)}`),
  ].join("\n");

  return respondAi(() => digestPortfolio(input));
}
