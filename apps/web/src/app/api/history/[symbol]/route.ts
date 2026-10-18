import { CHART_RANGES, type ChartRange } from "@pek/shared";
import { getHistory } from "@/server/data";
import { badRequest, parseSymbol, required, respond } from "@/server/http";

export async function GET(req: Request, ctx: RouteContext<"/api/history/[symbol]">) {
  const symbol = parseSymbol((await ctx.params).symbol);
  if (!symbol) return badRequest("Invalid symbol");
  const range = (new URL(req.url).searchParams.get("range") ?? "1D").toUpperCase() as ChartRange;
  if (!CHART_RANGES.includes(range)) return badRequest("Invalid range");
  return respond(async () => required(await getHistory(symbol, range), symbol));
}
