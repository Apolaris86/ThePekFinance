import { Suspense } from "react";
import { CompareView } from "@/components/compare/CompareView";

export default function ComparePage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-normal">Compare</h1>
      {/* CompareView reads ?s= from the URL, which is request data */}
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-surface" />}>
        <CompareView />
      </Suspense>
    </main>
  );
}
