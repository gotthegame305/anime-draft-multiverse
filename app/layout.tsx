import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import NavBar from "@/components/NavBar";
import MobileNav from "@/components/MobileNav";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Anime Draft Multiverse",
  description: "Assemble your dream team and battle across dimensions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white selection:bg-purple-500 selection:text-white`}
      >
        <Providers>
          <NavBar />
          <div className="pb-16 md:pb-0"> {/* Padding for MobileNav */}
            {children}
          </div>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
