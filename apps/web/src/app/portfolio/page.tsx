import { RequireAuth } from "@/lib/auth";
import { PortfolioView } from "@/components/portfolio/PortfolioView";

export default function PortfolioPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <RequireAuth>
        <PortfolioView />
      </RequireAuth>
    </main>
  );
}
