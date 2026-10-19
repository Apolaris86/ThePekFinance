import { RequireAuth } from "@/lib/auth";
import { AlertsView } from "@/components/alerts/AlertsView";

export default function AlertsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <RequireAuth>
        <AlertsView />
      </RequireAuth>
    </main>
  );
}
