import Link from "next/link";
import { SearchBox } from "./SearchBox";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          The<span className="text-accent">Pek</span>Finance
        </Link>
        <div className="flex-1 sm:mx-auto sm:max-w-xl">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
