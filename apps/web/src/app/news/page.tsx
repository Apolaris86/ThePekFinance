import { NewsView } from "@/components/news/NewsView";

export default function NewsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-normal">News</h1>
      <NewsView />
    </main>
  );
}
