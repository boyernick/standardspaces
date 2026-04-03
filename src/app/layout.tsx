import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/Navbar";
import CommandMenu from "@/components/CommandMenu";
import PageTransition from "@/components/PageTransition";
import "./globals.css";

const calibre = localFont({
  variable: "--font-calibre",
  src: [
    { path: "../../public/fonts/TestCalibre-Light.otf", weight: "300", style: "normal" },
    { path: "../../public/fonts/TestCalibre-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/TestCalibre-Medium.otf", weight: "500", style: "normal" },
    { path: "../../public/fonts/TestCalibre-Semibold.otf", weight: "600", style: "normal" },
    { path: "../../public/fonts/TestCalibre-Bold.otf", weight: "700", style: "normal" },
  ],
});

const martinaPlantijn = localFont({
  variable: "--font-martina",
  src: [
    { path: "../../public/fonts/TestMartinaPlantijn-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/TestMartinaPlantijn-Medium.otf", weight: "500", style: "normal" },
    { path: "../../public/fonts/TestMartinaPlantijn-Bold.otf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Standard Spaces",
  description: "A curated guide to the finest spaces in every city.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F3" },
    { media: "(prefers-color-scheme: dark)", color: "#13120A" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${calibre.variable} ${martinaPlantijn.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('theme');
            if (theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else if (theme === 'light') {
              // User explicitly chose light — respect it
            } else {
              // Auto: dark between 7pm and 7am
              var hour = new Date().getHours();
              if (hour >= 19 || hour < 7) {
                document.documentElement.classList.add('dark');
              }
            }
          })();
        `}} />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <CommandMenu />
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
