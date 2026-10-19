"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted">A data provider may be having a moment. Your watchlists and portfolio are safe.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={() => retry()} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background hover:opacity-90">
          Try again
        </button>
        <Link href="/" className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-surface">
          Back to markets
        </Link>
      </div>
    </main>
  );
}
