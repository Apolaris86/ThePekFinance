// Investment Type and Investment Theme for each holding, following the owner's
// own research spreadsheets. Keys are Yahoo symbols (CRWD-US -> CRWD, 0388-HK -> 0388.HK).
// Entries marked "inferred" weren't in the spreadsheets and were classified the
// same way; edit freely. Symbols missing here fall back to classifyFallback().

export type InvestmentType =
  | "Large Growth"
  | "Large Predictable (Defensive)"
  | "Large Predictable (Moderately Cyclical)"
  | "Speculative Growth"
  | "Turnaround"
  | "ETF";

export interface Classification {
  type: InvestmentType;
  theme: string;
}

const C = (type: InvestmentType, theme: string): Classification => ({ type, theme });

const LG = "Large Growth" as const;
const LPD = "Large Predictable (Defensive)" as const;
const LPC = "Large Predictable (Moderately Cyclical)" as const;
const SG = "Speculative Growth" as const;
const TA = "Turnaround" as const;
const ETF = "ETF" as const;

export const CLASSIFICATIONS: Record<string, Classification> = {
  // --- From the spreadsheets ---
  AAPL: C(LPC, "Discretionary"),
  ACGL: C(LPC, "Fintech"),
  AIPO: C(ETF, "AI CAPEX"),
  AMZN: C(LG, "Hyperscaler"),
  ASML: C(LG, "AI CAPEX"),
  AVGO: C(LG, "AI CAPEX"),
  AZO: C(LPC, "Discretionary"),
  BABA: C(TA, "China / Emerging Markets"),
  BKNG: C(LG, "Discretionary"),
  CNSWF: C(LG, "SaaS"),
  CPRT: C(LPC, "Discretionary"),
  CRWD: C(SG, "Cybersecurity"),
  CTAS: C(LPC, "Industrial"),
  DSGX: C(LG, "SaaS"),
  EVVTY: C(LPD, "Discretionary"),
  FTNT: C(LG, "Cybersecurity"),
  GOOGL: C(LG, "Hyperscaler"),
  GXC: C(ETF, "China / Emerging Markets"),
  HCA: C(LPD, "Healthcare"),
  ICE: C(LPD, "Fintech"),
  IDXX: C(LPD, "Healthcare"),
  IHI: C(ETF, "Healthcare"),
  LIN: C(LPC, "Industrial"),
  LVMUY: C(TA, "Discretionary"),
  MA: C(LPC, "Fintech"),
  MBGL: C(LPD, "Industrial"), // theme blank in the sheet; inferred
  MELI: C(LG, "Fintech"),
  META: C(LG, "Hyperscaler"),
  MSCI: C(LPC, "Fintech"),
  MSFT: C(LG, "Hyperscaler"),
  MSI: C(LPC, "Telecommunications"),
  NFLX: C(LG, "Discretionary"),
  NKE: C(TA, "Discretionary"),
  NOW: C(LG, "SaaS"),
  NVDA: C(LG, "AI CAPEX"),
  NVO: C(LPD, "Healthcare"),
  PANW: C(LG, "Cybersecurity"),
  PLTR: C(LG, "SaaS"),
  POOL: C(TA, "Discretionary"),
  SHLD: C(ETF, "Global Defense"),
  SPGI: C(LPD, "Fintech"),
  TMO: C(LPD, "Healthcare"),
  WM: C(LPD, "Industrial"),
  "0388.HK": C(LPC, "China / Emerging Markets"),
  "3067.HK": C(ETF, "China / Emerging Markets"),
  "9988.HK": C(TA, "China / Emerging Markets"),

  // --- Inferred, same scheme ---
  GOOG: C(LG, "Hyperscaler"),
  "MC.PA": C(TA, "Discretionary"), // LVMH, as LVMUY
  "RMS.PA": C(LPD, "Discretionary"),
  "OR.PA": C(LPD, "Discretionary"),
  "AIR.PA": C(LPC, "Global Defense"),
  "SAF.PA": C(LPC, "Global Defense"),
  "TTE.PA": C(LPC, "Energy"),
  "SU.PA": C(LPC, "Industrial"),
  "D05.SI": C(LPC, "Banking"),
  "O39.SI": C(LPC, "Banking"),
  "U11.SI": C(LPC, "Banking"),
  "Z74.SI": C(LPD, "Telecommunications"),
  "C6L.SI": C(TA, "Discretionary"),
  TSM: C(LG, "AI CAPEX"),
  AMD: C(LG, "AI CAPEX"),
  TSLA: C(SG, "Discretionary"),
  V: C(LPC, "Fintech"),
  JPM: C(LPC, "Banking"),
  COST: C(LPD, "Discretionary"),
  ADBE: C(LG, "SaaS"),
  CRM: C(LG, "SaaS"),
  ORCL: C(LG, "Hyperscaler"),
  SPY: C(ETF, "Broad Market"),
  VOO: C(ETF, "Broad Market"),
  QQQ: C(ETF, "Broad Market"),
};

/** Yahoo sector -> the closest theme, for holdings not in the map. */
const SECTOR_THEMES: Record<string, string> = {
  Technology: "Technology",
  Healthcare: "Healthcare",
  "Financial Services": "Fintech",
  "Consumer Cyclical": "Discretionary",
  "Consumer Defensive": "Staples",
  Industrials: "Industrial",
  "Communication Services": "Telecommunications",
  Energy: "Energy",
  Utilities: "Utilities",
  "Real Estate": "Real Estate",
  "Basic Materials": "Materials",
};

export interface ClassificationResult {
  type: InvestmentType | "Unclassified";
  theme: string;
  /** true when guessed from the instrument type and sector rather than the map */
  auto: boolean;
}

/** Classification for a symbol: the map first, else a best guess from quote type and sector. */
export function classify(symbol: string, quoteType?: string, sector?: string): ClassificationResult {
  const known = CLASSIFICATIONS[symbol];
  if (known) return { ...known, auto: false };
  const fund = quoteType === "ETF" || quoteType === "MUTUALFUND";
  return {
    type: fund ? "ETF" : "Unclassified",
    theme: (sector && SECTOR_THEMES[sector]) || "Unclassified",
    auto: true,
  };
}
