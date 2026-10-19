"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
  { href: "/news", label: "News" },
  { href: "/compare", label: "Compare" },
];

export function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const item = "shrink-0 px-3 py-2 text-sm font-medium transition";

  return (
    <nav className={`no-scrollbar items-center gap-1 overflow-x-auto ${className}`}>
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`${item} ${active ? "text-accent" : "text-muted hover:text-foreground"}`}>
            {l.label}
          </Link>
        );
      })}
      <span className="ml-auto md:ml-2" />
      {user ? (
        <button onClick={signOut} title={user.email} className={`${item} text-muted hover:text-foreground`}>
          Sign out
        </button>
      ) : (
        <Link href="/login" className={`${item} text-accent`}>
          Sign in
        </Link>
      )}
    </nav>
  );
}
