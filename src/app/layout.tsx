import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

// 학습용 루트 레이아웃.
// 학습 포인트:
//  - next/font/google 은 빌드 시 폰트를 self-host 로 받아 FOUT 없이 즉시 렌더.
//  - variable 폰트라 단일 파일로 weight 100~900 다 커버.
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "학습용 블로그",
  description: "Next.js 15 + React 19 학습 프로젝트",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  // suppressHydrationWarning: next-themes 가 클래스 토글 시 hydration mismatch 를 의도적으로 만들기 때문.
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <Header />
            {/* flex-1 — 콘텐츠가 짧아도 푸터가 항상 화면 하단에 붙도록. */}
            <div className="flex-1">{children}</div>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
