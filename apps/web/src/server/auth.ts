import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export interface AuthedRequest {
  user: User;
  /** Supabase client acting as this user, so row level security applies */
  supabase: SupabaseClient;
}

/**
 * Verifies the `Authorization: Bearer <supabase access token>` header.
 * Returns the user, or a 401 Response to send back as-is.
 */
export async function requireUser(req: Request): Promise<AuthedRequest | Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const unauthorized = Response.json({ error: "Sign in required" }, { status: 401 });
  if (!url || !anon || !jwt) return unauthorized;

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return unauthorized;
  return { user: data.user, supabase };
}
