import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { cacheLife } from "next/cache";
import { z } from "zod";
import type { PortfolioDigest, StockSummary } from "@pek/shared";

// Claude Haiku 5.5 for both recaps: short, factual summarisation of data we pass in.
const MODEL = "claude-haiku-5-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const SYSTEM = `You write short, factual market recaps for a personal stock-tracking dashboard.
Work only from the data and headlines provided; never invent figures, events or quotes.
Describe what happened and what the news says. Do not give investment advice, price targets, or buy, sell or hold recommendations, even implicitly.
If the headlines are sparse or unrelated to the company, say so plainly rather than stretching them.
Write in plain English for a non-professional investor. Keep each point to one or two sentences.`;

const StockSummarySchema = z.object({
  headline: z.string().describe("One-sentence recap of the stock's day"),
  points: z.array(z.string()).describe("3 to 5 short bullet points"),
  sentiment: z.enum(["positive", "negative", "mixed", "neutral"]).describe("Overall tone of today's news and price move"),
});

const DigestSchema = z.object({
  headline: z.string().describe("One-sentence recap of the portfolio's day"),
  points: z.array(z.string()).describe("3 to 6 bullet points covering the biggest movers and relevant news"),
  watch: z.array(z.string()).describe("0 to 3 upcoming events or open questions worth keeping an eye on, phrased neutrally"),
});

async function ask<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort: "low", format: zodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to summarise this");
  if (!response.parsed_output) throw new Error(`No summary produced (stop_reason: ${response.stop_reason})`);
  return response.parsed_output;
}

/**
 * Cached per prompt input: the caller includes the date in `input`, so each
 * ticker gets at most one summary per day per server instance.
 */
export async function summarizeStock(symbol: string, input: string): Promise<StockSummary> {
  "use cache";
  cacheLife("hours");
  const out = await ask(
    StockSummarySchema,
    `Summarise today for ${symbol}.\n\n${input}`,
  );
  return { symbol, ...out, generatedAt: Date.now() };
}

/** Cached per input, which includes the date and the holdings, so edits produce a fresh digest. */
export async function digestPortfolio(input: string): Promise<PortfolioDigest> {
  "use cache";
  cacheLife("hours");
  const out = await ask(DigestSchema, `Write today's digest for this portfolio.\n\n${input}`);
  return { ...out, generatedAt: Date.now() };
}
