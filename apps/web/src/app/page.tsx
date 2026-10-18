import { TickerCard } from "@/components/TickerCard";

const GROUPS: { title: string; symbols: string[] }[] = [
  { title: "United States", symbols: ["AAPL", "NVDA", "MSFT", "SPY"] },
  { title: "Singapore", symbols: ["D05.SI", "O39.SI", "Z74.SI", "C6L.SI"] },
  { title: "Paris", symbols: ["MC.PA", "OR.PA", "TTE.PA", "AIR.PA"] },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-normal">Markets</h1>
      <p className="mt-1 text-sm text-muted">Search any US, SGX or Paris ticker above, or start with these.</p>
      <div className="mt-6 space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-sm font-medium text-muted">{g.title}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {g.symbols.map((s) => (
                <TickerCard key={s} symbol={s} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
