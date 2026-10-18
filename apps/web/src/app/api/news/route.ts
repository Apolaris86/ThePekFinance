import { getNews } from "@/server/data";
import { badRequest, parseSymbol, respond } from "@/server/http";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("symbol");
  const symbol = raw ? parseSymbol(raw) : undefined;
  if (symbol === null) return badRequest("Invalid symbol");
  return respond(() => getNews(symbol));
}
