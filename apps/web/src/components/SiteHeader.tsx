import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "./NavLinks";
import { SearchBox } from "./SearchBox";

export function SiteHeader() {
  // NavLinks reads the pathname, which is request data on dynamic routes,
  // so it streams in behind Suspense while the rest of the header stays static.
  const nav = (className: string) => (
    <Suspense fallback={<div className={`h-9 ${className}`} />}>
      <NavLinks className={className} />
    </Suspense>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          The<span className="text-accent">Pek</span>Finance
        </Link>
        <div className="min-w-0 flex-1 md:mx-auto md:max-w-xl">
          <SearchBox />
        </div>
        {nav("hidden md:flex")}
      </div>
      {nav("flex border-t border-border px-4 md:hidden")}
    </header>
  );
}
