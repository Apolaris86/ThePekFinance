import { timezoneOf } from "@pek/shared";
import { summarizeStock } from "@/server/ai";
import { headlineList, respondAi } from "@/server/ai-http";
import { requireUser } from "@/server/auth";
import { getNews, getProfile, getQuote } from "@/server/data";
import { badRequest, parseSymbol } from "@/server/http";

export async function GET(req: Request, ctx: RouteContext<"/api/ai/summary/[symbol]">) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const symbol = parseSymbol((await ctx.params).symbol);
  if (!symbol) return badRequest("Invalid symbol");

  const [quote, news, profile] = await Promise.all([getQuote(symbol), getNews(symbol).catch(() => []), getProfile(symbol)]);
  if (!quote) return Response.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });

  const tz = timezoneOf(quote.exchange);
  const day = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const lastTrade = new Date(quote.timestamp).toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
  const input = [
    `Today's date: ${day}`,
    `Price data is from the last trade at ${lastTrade} (exchange local time); if that is an earlier day, describe it as the most recent session, not today.`,
    `Company: ${quote.name ?? symbol}${profile?.sector ? ` (${profile.sector}, ${profile.industry})` : ""}`,
    `Price: ${quote.price} ${quote.currency}, change today ${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)`,
    `Previous close: ${quote.previousClose}; day range: ${quote.dayLow ?? "?"}-${quote.dayHigh ?? "?"}; 52-week range: ${quote.fiftyTwoWeekLow ?? "?"}-${quote.fiftyTwoWeekHigh ?? "?"}`,
    `Market state: ${quote.marketState ?? "unknown"}`,
    `Recent headlines:\n${headlineList(news, 10)}`,
  ].join("\n");

  return respondAi(() => summarizeStock(symbol, input));
}
