import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

// Hands the Finnhub key to a signed-in user so the browser can open the
// WebSocket directly (Vercel functions can't hold sockets open). Finnhub has
// no short-lived tokens, so the key itself is returned; never to anonymous callers.
export async function GET(req: Request) {
  await connection(); // per-request: must never be prerendered
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return Response.json({ error: "Live prices not configured" }, { status: 404 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!url || !anon || !jwt) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data, error } = await createClient(url, anon).auth.getUser(jwt);
  if (error || !data.user) return Response.json({ error: "Sign in required" }, { status: 401 });

  return Response.json({ token: key }, { headers: { "Cache-Control": "private, no-store" } });
}
