import { RequireAuth } from "@/lib/auth";
import { WatchlistView } from "@/components/watchlist/WatchlistView";

export default function WatchlistPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <RequireAuth>
        <WatchlistView />
      </RequireAuth>
    </main>
  );
}
