import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { HeaderNav } from "@/components/header-nav";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "こがねむしクラウド",
  description: "税金・節税シミュレーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased`}>
        <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
          <HeaderNav />
          <span className="text-lg font-bold">こがねむしクラウド</span>
        </header>
        {children}
      </body>
    </html>
  );
}
