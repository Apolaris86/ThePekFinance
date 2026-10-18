import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThePekFinance",
  description: "Live prices, news and portfolio tracking",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <SiteHeader />
          {children}
          <footer className="mt-auto border-t border-border px-4 py-6 text-center text-xs text-muted">
            Data from Yahoo Finance and Finnhub. SGX and Paris prices may be delayed. Not financial advice.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
