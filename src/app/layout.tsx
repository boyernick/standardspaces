import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Standard Spaces",
  description: "A curated guide to the finest spaces in every city.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              Standard Spaces
            </Link>
            <nav className="flex gap-8 text-sm text-neutral-500">
              <Link href="/miami" className="hover:text-neutral-900 transition-colors">
                Miami
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200">
          <div className="max-w-7xl mx-auto px-6 py-8 text-xs text-neutral-400">
            © {new Date().getFullYear()} Standard Spaces
          </div>
        </footer>
      </body>
    </html>
  );
}
