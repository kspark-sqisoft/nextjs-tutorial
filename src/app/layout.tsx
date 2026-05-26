import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";

// 학습용 루트 레이아웃.
// i18n 은 마일스톤 9 에서 [locale] segment 로 정식 도입. 지금은 ko 고정.
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // suppressHydrationWarning: next-themes 가 클래스 토글 시 hydration mismatch 를 의도적으로 만들기 때문.
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
