import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import CommandMenu from "@/components/CommandMenu";
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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
  themeColor: "#F7F7F3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${calibre.variable} ${martinaPlantijn.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('theme');
            var isDark = false;
            if (theme === 'dark') {
              isDark = true;
            } else if (theme === 'light') {
              isDark = false;
            } else {
              var hour = new Date().getHours();
              isDark = (hour >= 19 || hour < 7);
            }
            if (isDark) {
              document.documentElement.classList.add('dark');
              document.documentElement.style.backgroundColor = '#13120A';
              var meta = document.querySelector('meta[name="theme-color"]');
              if (meta) meta.setAttribute('content', '#13120A');
            }
          })();
        `}} />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <CommandMenu />
        {children}
      </body>
    </html>
  );
}
