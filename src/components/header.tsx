// 전역 헤더 — RSC. sticky + backdrop-blur 로 글래스모피즘.
// 학습 포인트: backdrop-blur 는 부모 배경의 색만 살짝 보이게 하려면 bg-*/N (알파) 와 함께 써야 한다.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { SignOutButton } from "./auth/sign-out-button";
import { Button } from "@/components/ui/button";

export async function Header() {
  const me = await getCurrentUser();
  const t = await getTranslations("nav");
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6 text-sm">
        {/* 로고 — 작은 dot + 타이트한 자간. */}
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block size-2 rounded-full bg-foreground"
          />
          <span>학습용 블로그</span>
        </Link>

        {/* 메인 내비 — 비활성 시엔 muted, hover 시 foreground. */}
        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground"
          >
            {t("home")}
          </Link>
          {me && (
            <Link
              href="/posts/new"
              className="text-muted-foreground hover:text-foreground"
            >
              {t("write")}
            </Link>
          )}
          {me && (
            <Link
              href="/me/bookmarks"
              className="text-muted-foreground hover:text-foreground"
            >
              {t("bookmarks")}
            </Link>
          )}
          {me?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="text-amber-600 hover:text-amber-500"
            >
              {t("admin")}
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {me ? (
            <SignOutButton />
          ) : (
            <Link href="/sign-in">
              <Button size="sm">{t("signIn")}</Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
