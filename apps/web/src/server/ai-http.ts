import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { aiEnabled } from "./ai";

/** Runs an AI call and maps failures to friendly HTTP errors. */
export async function respondAi<T>(fn: () => Promise<T>): Promise<Response> {
  if (!aiEnabled()) return Response.json({ error: "AI summaries are not configured" }, { status: 503 });
  try {
    return Response.json(await fn(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The Anthropic API key was rejected" }, { status: 503 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many AI requests, try again in a minute" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return Response.json({ error: "The AI service is unavailable right now" }, { status: 502 });
    }
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : "Summary failed" }, { status: 502 });
  }
}

export function headlineList(items: { headline: string; source: string; publishedAt: number }[], limit: number): string {
  if (items.length === 0) return "(no recent headlines)";
  return items
    .slice(0, limit)
    .map((n) => `- ${n.headline} (${n.source}, ${new Date(n.publishedAt).toISOString().slice(0, 10)})`)
    .join("\n");
}
