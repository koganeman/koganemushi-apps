import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
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
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold">こがねむしクラウド</span>
            <span className="ml-2 text-xs text-muted-foreground">円単位で入力してください</span>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-gray-600 hover:text-blue-700 font-medium">
              役員報酬
            </Link>
            <Link href="/hojinnari" className="text-gray-600 hover:text-blue-700 font-medium">
              法人なり
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
