import "./globals.css";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

// 학습용 루트 레이아웃.
// i18n: cookie 'blog_locale' 로 결정된 locale + messages 를 RSC/클라이언트 양쪽에 공급.
// [locale] segment 정식 도입은 추후 작업으로 분리.
export const metadata: Metadata = {
  title: "학습용 블로그",
  description: "Next.js 15 + React 19 학습 프로젝트",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <Header />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
