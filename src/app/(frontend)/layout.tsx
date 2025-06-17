import type { Metadata } from "next";
import { Playfair_Display, Inter, Dancing_Script } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/navigation/Navigation";
import Footer from "@/components/Footer";

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const dancingScript = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elite Construction Company | Luxury Custom Homes & Renovations",
  description:
    "Premium construction services for discerning homeowners and businesses who demand excellence. 25+ years experience building architectural masterpieces that stand the test of time.",
  keywords:
    "luxury construction, custom homes, premium renovations, commercial construction, elite builders",
  authors: [{ name: "Elite Construction Company" }],
  creator: "Elite Construction Company",
  openGraph: {
    title: "Elite Construction Company | Crafting Architectural Masterpieces",
    description:
      "Premium construction services for discerning homeowners and businesses who demand excellence.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Elite Construction Company | Luxury Custom Homes",
    description:
      "Premium construction services for discerning homeowners and businesses who demand excellence.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
    >
      <body
        className={`${inter.variable} ${playfair.variable} ${dancingScript.variable} antialiased`}
      >
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}
