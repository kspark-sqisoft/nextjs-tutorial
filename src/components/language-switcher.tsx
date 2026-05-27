"use client";
// 언어 토글 — cookie 'blog_locale' 갱신 후 router.refresh() 로 RSC 재실행.
// next-intl 의 request.ts 가 cookie 를 다시 읽어 새 messages 로딩.
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

function setLocaleCookie(next: "ko" | "en") {
  // 1년 만료.
  document.cookie = `blog_locale=${next}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  function switchTo(next: "ko" | "en") {
    if (locale === next) return;
    setLocaleCookie(next);
    router.refresh();
  }
  return (
    <div className="flex gap-1">
      <Button
        variant={locale === "ko" ? "default" : "ghost"}
        size="sm"
        onClick={() => switchTo("ko")}
      >
        KO
      </Button>
      <Button
        variant={locale === "en" ? "default" : "ghost"}
        size="sm"
        onClick={() => switchTo("en")}
      >
        EN
      </Button>
    </div>
  );
}
