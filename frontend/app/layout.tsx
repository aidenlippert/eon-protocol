import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eon Protocol - Undercollateralized Lending",
  description: "Time as Collateral. Borrow more with on-chain reputation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased bg-black text-white`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
