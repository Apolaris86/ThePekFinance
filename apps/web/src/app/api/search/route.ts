import { searchSymbols } from "@/server/data";
import { badRequest, respond } from "@/server/http";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return Response.json([]);
  if (q.length > 40) return badRequest("Query too long");
  return respond(() => searchSymbols(q));
}
