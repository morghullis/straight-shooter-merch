import type { Metadata, Viewport } from "next";
import {
  Barlow_Semi_Condensed,
  Inter,
  Mr_De_Haviland,
  Playfair_Display,
  Sofia_Sans_Extra_Condensed,
  Special_Elite,
} from "next/font/google";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MotionAttribute } from "@/components/motion/motion-preference";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { site } from "@/config/site";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--ff-inter", display: "swap" });

// Headlines: ultra-heavy condensed (hero, section titles, tile titles).
const display = Sofia_Sans_Extra_Condensed({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--ff-display",
  display: "swap",
});

// Main navigation.
const nav = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--ff-nav",
  display: "swap",
});

// POTUS wordmark.
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "900"],
  variable: "--ff-serif",
  display: "swap",
});

// Hero signature.
const script = Mr_De_Haviland({
  subsets: ["latin"],
  weight: "400",
  variable: "--ff-script",
  display: "swap",
});

// Fine print on tickets and ballots: typewriter, so it reads as printed and stamped.
const type = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--ff-type",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.shortName} | Official Merch`,
    template: `%s | ${site.shortName}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.shortName} | Official Merch`,
    description: site.description,
  },
  // Preview deployments set SITE_PREVIEW=1 so they stay out of search engines.
  ...(process.env.SITE_PREVIEW === "1" ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${nav.variable} ${serif.variable} ${script.variable} ${type.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-black text-white antialiased">
        <CartProvider>
          <MotionAttribute />
          <ScrollProgress />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
