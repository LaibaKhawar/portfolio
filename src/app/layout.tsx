import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FlowTransitionProvider } from "@/components/flow/FlowTransition";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { SiteNav } from "@/components/shell/SiteNav";
import { Footer } from "@/components/shell/Footer";
import { Cursor } from "@/components/shell/Cursor";
import { profile } from "@/content/profile";
import { siteDescription, siteTitle, siteUrl } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s | Laiba Khawar" },
  description: siteDescription,
  authors: [{ name: profile.name, url: profile.github }],
  keywords: ["AI Engineer", "LLM", "RAG", "Generative AI", "Agentic AI", "Graph AI", "NLP", "FastAPI", "Laiba Khawar"],
  openGraph: { type: "website", siteName: profile.name, title: siteTitle, description: siteDescription, url: "/" },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#0a0a0b", colorScheme: "dark" };

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.role,
  email: `mailto:${profile.email}`,
  address: { "@type": "PostalAddress", addressLocality: "Islamabad", addressCountry: "PK" },
  sameAs: [profile.github, profile.linkedin],
  alumniOf: { "@type": "CollegeOrUniversity", name: "FAST-NUCES" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="grain min-h-dvh bg-bg text-fg">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          Skip to content
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
        <FlowTransitionProvider>
          <SmoothScroll>
            <div id="top-sentinel" aria-hidden className="absolute top-0 h-4 w-px" />
            <SiteNav />
            <main id="main">{children}</main>
            <Footer />
          </SmoothScroll>
        </FlowTransitionProvider>
        <Cursor />
      </body>
    </html>
  );
}
