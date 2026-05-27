// 전역 헤더 — RSC. getCurrentUser 로 로그인 상태 분기 + 메시지 키 사용.
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
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 p-4 text-sm">
        <Link href="/" className="font-semibold">
          📒 학습용 블로그
        </Link>
        <Link href="/" className="text-muted-foreground">
          {t("home")}
        </Link>
        {me && (
          <Link href="/posts/new" className="text-muted-foreground">
            {t("write")}
          </Link>
        )}
        {me && (
          <Link href="/me/bookmarks" className="text-muted-foreground">
            {t("bookmarks")}
          </Link>
        )}
        {me?.role === "ADMIN" && (
          <Link href="/admin" className="text-amber-600">
            {t("admin")}
          </Link>
        )}
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
