import type { Exchange } from "@pek/shared";
import { getMovers } from "@/server/data";
import { badRequest, respond } from "@/server/http";

const MARKETS: Exchange[] = ["US", "SGX", "EPA"];

export async function GET(req: Request) {
  const market = (new URL(req.url).searchParams.get("market") ?? "US").toUpperCase() as Exchange;
  if (!MARKETS.includes(market)) return badRequest("market must be US, SGX or EPA");
  return respond(() => getMovers(market));
}
