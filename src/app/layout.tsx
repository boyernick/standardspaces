import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CommandMenu from "@/components/CommandMenu";
import ThemeSync from "@/components/ThemeSync";
import "@/lib/env"; // fail fast at boot if required env vars are missing
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://standardspaces.com"),
  title: {
    default: "Standard Spaces",
    template: "%s | Standard Spaces",
  },
  description: "A curated guide to the best spaces in Miami.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Standard Spaces",
    description: "A curated guide to the best spaces in Miami.",
    siteName: "Standard Spaces",
    type: "website",
    images: [{ url: "/og-miami-v2.jpg", width: 1200, height: 788, alt: "Standard Spaces" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Standard Spaces",
    description: "A curated guide to the best spaces in Miami.",
    images: ["/og-miami-v2.jpg"],
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
  // Belt-and-braces with maximumScale: some iOS Safari versions ignore
  // maximumScale alone and let a two-finger pinch escape the Mapbox canvas
  // and zoom the whole browser viewport.
  userScalable: false,
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
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=false;if(t==='dark'){d=true;}else if(t==='light'){d=false;}else{d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;}if(d){document.documentElement.classList.add('dark');document.documentElement.style.backgroundColor='#13120A';var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content','#13120A');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeSync />
        <CommandMenu />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
