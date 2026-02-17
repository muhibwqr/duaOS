import type { Metadata } from "next";
import { EB_Garamond, Quicksand, Amiri } from "next/font/google";
import "./globals.css";
import RamadanBackground from "@/components/RamadanBackground";

const garamond = EB_Garamond({
  variable: "--font-apple-garamond",
  subsets: ["latin"],
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  display: "swap",
});

const amiri = Amiri({
  weight: ["400", "700"],
  variable: "--font-calligraphy",
  subsets: ["latin", "arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DuaOS",
  description: "Match your intent to Allah's Names and refine your du'a.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${garamond.variable} ${quicksand.variable} ${amiri.variable} font-serif antialiased relative min-h-screen text-slate-200`}>
        <RamadanBackground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
