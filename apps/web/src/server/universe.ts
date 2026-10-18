import "server-only";

// Index constituents used to compute SGX and Paris movers (Yahoo's screeners are US-only).
// Approximate lists; tickers Yahoo no longer knows are dropped automatically.

export const STI = [
  "D05", "O39", "U11", "Z74", "C6L", "BN4", "C38U", "A17U", "M44U", "N2IU",
  "ME8U", "J36", "H78", "C09", "9CI", "S68", "S63", "U96", "Y92", "BS6",
  "G13", "F34", "V03", "U14", "5E2", "AJBU", "BUOU", "S58", "D01", "C52",
].map((s) => `${s}.SI`);

export const CAC40 = [
  "AI", "AIR", "ALO", "MT", "CS", "BNP", "EN", "CAP", "CA", "ACA",
  "BN", "DSY", "EDEN", "ENGI", "EL", "ERF", "RMS", "KER", "OR", "LR",
  "MC", "ML", "ORA", "RI", "PUB", "RNO", "SAF", "SGO", "SAN", "SU",
  "GLE", "STLAP", "STMPA", "TEP", "HO", "TTE", "URW", "VIE", "DG", "VIV",
].map((s) => `${s}.PA`);

/** US large caps: fallback when Yahoo's screeners come back empty (they reset overnight). */
export const US_LARGE_CAPS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "BRK-B", "JPM",
  "LLY", "V", "UNH", "XOM", "MA", "COST", "HD", "PG", "JNJ", "WMT",
  "NFLX", "BAC", "ABBV", "CRM", "ORCL", "AMD", "KO", "CVX", "MRK", "PEP",
  "ADBE", "TMO", "CSCO", "INTC", "QCOM", "DIS", "MCD", "IBM", "PLTR", "UBER",
];
