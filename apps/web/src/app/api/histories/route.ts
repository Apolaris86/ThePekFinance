import { CHART_RANGES, type Candle, type ChartRange } from "@pek/shared";
import { getHistory } from "@/server/data";
import { badRequest, parseSymbol } from "@/server/http";

const MAX_SYMBOLS = 60;
const CONCURRENCY = 8;

// GET /api/histories?symbols=AAPL,MSFT&range=1Y -> { AAPL: Candle[], MSFT: Candle[] }
// One request for a whole portfolio's history; a symbol that fails comes back as [] instead of failing the batch.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const raw = (params.get("symbols") ?? "").split(",").filter(Boolean);
  if (raw.length === 0 || raw.length > MAX_SYMBOLS) return badRequest(`Pass 1-${MAX_SYMBOLS} comma-separated symbols`);
  const symbols = raw.map(parseSymbol);
  if (symbols.some((s) => s === null)) return badRequest("Invalid symbol");
  const range = (params.get("range") ?? "1M").toUpperCase() as ChartRange;
  if (!CHART_RANGES.includes(range)) return badRequest("Invalid range");

  const queue = [...new Set(symbols as string[])];
  const out: Record<string, Candle[]> = {};
  async function worker() {
    for (let s = queue.shift(); s; s = queue.shift()) {
      out[s] = (await getHistory(s, range).catch(() => null)) ?? [];
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return Response.json(out);
}
