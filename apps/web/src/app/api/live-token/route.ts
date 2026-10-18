import { connection } from "next/server";
import { requireUser } from "@/server/auth";

// Hands the Finnhub key to a signed-in user so the browser can open the
// WebSocket directly (Vercel functions can't hold sockets open). Finnhub has
// no short-lived tokens, so the key itself is returned; never to anonymous callers.
export async function GET(req: Request) {
  await connection(); // per-request: must never be prerendered
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return Response.json({ error: "Live prices not configured" }, { status: 404 });

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  return Response.json({ token: key }, { headers: { "Cache-Control": "private, no-store" } });
}
