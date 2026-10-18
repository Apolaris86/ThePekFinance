import Link from "next/link";
import type { NewsItem } from "@pek/shared";
import { timeAgo } from "@/lib/format";

interface Props {
  items: NewsItem[] | undefined;
  loading: boolean;
  limit?: number;
  /** tickers to show as chips on each story (e.g. which holding it relates to) */
  tagsFor?: (item: NewsItem) => string[];
  empty?: string;
}

export function NewsList({ items, loading, limit = 10, tagsFor, empty = "No recent news." }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    );
  }
  if (!items?.length) return <p className="text-sm text-muted">{empty}</p>;

  return (
    <ul className="divide-y divide-border">
      {items.slice(0, limit).map((n) => {
        const tags = tagsFor?.(n) ?? [];
        return (
          <li key={n.id} className="flex gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {tags.map((t) => (
                  <Link
                    key={t}
                    href={`/quote/${encodeURIComponent(t)}`}
                    className="rounded bg-accent/10 px-1.5 py-0.5 font-mono font-semibold text-accent hover:underline"
                  >
                    {t}
                  </Link>
                ))}
                <span>
                  {n.source} · {timeAgo(n.publishedAt)}
                </span>
              </p>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium leading-snug hover:text-accent">
                {n.headline}
              </a>
            </div>
            {n.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.image} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
