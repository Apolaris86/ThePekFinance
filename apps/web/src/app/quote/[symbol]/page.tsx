import { Suspense } from "react";
import { normalizeSymbol } from "@pek/shared";
import { StockView } from "@/components/stock/StockView";

async function Content({ params }: { params: PageProps<"/quote/[symbol]">["params"] }) {
  const { symbol } = await params;
  return <StockView symbol={normalizeSymbol(symbol)} />;
}

export default function QuotePage({ params }: PageProps<"/quote/[symbol]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-surface" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
