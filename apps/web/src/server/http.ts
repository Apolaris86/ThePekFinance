import "server-only";
import { isValidSymbol, normalizeSymbol } from "@pek/shared";
import { NotFoundError } from "./providers";

export function parseSymbol(raw: string): string | null {
  const s = normalizeSymbol(raw);
  return isValidSymbol(s) ? s : null;
}

export const badRequest = (message: string) => Response.json({ error: message }, { status: 400 });

/** Throws NotFoundError when a cached lookup came back null. */
export function required<T>(value: T | null, symbol: string): T {
  if (value === null) throw new NotFoundError(symbol);
  return value;
}

/** Runs a data call and maps provider errors to HTTP responses. */
export async function respond<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    console.error(err);
    return Response.json({ error: "Market data unavailable" }, { status: 502 });
  }
}
