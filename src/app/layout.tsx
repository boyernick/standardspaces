import type { Metadata } from "next";
import localFont from "next/font/local";
import CommandMenu from "@/components/CommandMenu";
import ThemeProvider from "@/components/ThemeProvider";
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
    icon: "/logo.svg",
  },
  other: {
    "theme-color": "#F7F7F3",
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${calibre.variable} ${martinaPlantijn.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeProvider>
          <CommandMenu />
          <main className="flex-1 overflow-hidden">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
