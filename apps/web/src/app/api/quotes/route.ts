import { getQuotes } from "@/server/data";
import { badRequest, parseSymbol, respond } from "@/server/http";

// GET /api/quotes?symbols=AAPL,D05.SI,^STI
export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("symbols") ?? "").split(",").filter(Boolean);
  if (raw.length === 0 || raw.length > 50) return badRequest("Pass 1-50 comma-separated symbols");
  const symbols = raw.map(parseSymbol);
  if (symbols.some((s) => s === null)) return badRequest("Invalid symbol");
  return respond(() => getQuotes((symbols as string[]).sort()));
}
