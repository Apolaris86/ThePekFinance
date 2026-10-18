import { getQuote } from "@/server/data";
import { badRequest, parseSymbol, required, respond } from "@/server/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/quote/[symbol]">) {
  const symbol = parseSymbol((await ctx.params).symbol);
  if (!symbol) return badRequest("Invalid symbol");
  return respond(async () => required(await getQuote(symbol), symbol));
}
