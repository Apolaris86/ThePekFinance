import { MarketOverview } from "@/components/home/MarketOverview";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <h1 className="sr-only">Market overview</h1>
      <MarketOverview />
    </main>
  );
}
