import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Mono, Inter, Noto_Sans_Devanagari, Tiro_Devanagari_Hindi } from "next/font/google";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { cx } from "@/utils/cx";
import "@/styles/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  preload: false,
});

// Tiro is one book face drawn for both scripts, so Hindi and English headings match. Plex Mono sets staff figures.
const ledger = Tiro_Devanagari_Hindi({ variable: "--font-ledger", subsets: ["latin", "devanagari"], weight: "400", preload: false });
const figures = IBM_Plex_Mono({ variable: "--font-figures", subsets: ["latin"], weight: "400", preload: false });

export const metadata: Metadata = {
  title: "Company A | Coaching fees",
  description: "Fee tracking and parent portal for Company A, Jaipur.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = (await cookies()).get("lang")?.value === "en" ? "en" : "hi";
  return (
    <html
      lang={lang}
      dir="ltr"
      className={cx(inter.variable, devanagari.variable, ledger.variable, figures.variable, "h-full antialiased")}
    >
      <body className="min-h-full bg-background-primary-default font-sans text-text-primary">
        <DirectionProvider locale={lang}>{children}</DirectionProvider>
      </body>
    </html>
  );
}
