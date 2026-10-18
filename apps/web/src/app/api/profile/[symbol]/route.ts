import { getProfile } from "@/server/data";
import { badRequest, parseSymbol, respond } from "@/server/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/profile/[symbol]">) {
  const symbol = parseSymbol((await ctx.params).symbol);
  if (!symbol) return badRequest("Invalid symbol");
  return respond(() => getProfile(symbol));
}
