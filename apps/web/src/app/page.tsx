import { currencyOf, exchangeOf } from "@pek/shared";

const sample = ["AAPL", "D05.SI", "MC.PA"];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">ThePekFinance</h1>
      <p className="mt-2 text-zinc-500">Markets, news and your portfolio. Live data coming in Phase 1.</p>
      <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {sample.map((s) => (
          <li key={s} className="flex justify-between px-4 py-3 font-mono text-sm">
            <span>{s}</span>
            <span className="text-zinc-500">
              {exchangeOf(s)} · {currencyOf(exchangeOf(s))}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
