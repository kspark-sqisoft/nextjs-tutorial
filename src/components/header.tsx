// 전역 헤더 — RSC. sticky + backdrop-blur 글래스모피즘.
// 학습 포인트:
//  - backdrop-blur 는 부모 배경의 색만 살짝 보이게 하려면 bg-*/N (알파) 와 함께.
//  - 로그인 상태면 아바타 → /me 링크로 진입. role==='ADMIN' 일 때만 어드민 메뉴 노출.
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { publicUrl } from "@/server/storage/s3";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { SignOutButton } from "./auth/sign-out-button";
import { Button } from "@/components/ui/button";

export async function Header() {
  const me = await getCurrentUser();
  const t = await getTranslations("nav");
  const avatarUrl = me?.avatarKey ? publicUrl(me.avatarKey) : null;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6 text-sm">
        {/* 로고. */}
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

        {/* 메인 내비. */}
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
            <>
              {/* 아바타 → /me. 닉네임은 sr-only 로 접근성만. */}
              <Link
                href="/me"
                aria-label={`${me.nickname} 프로필`}
                title={me.nickname}
                className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border transition hover:ring-foreground/30"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {me.nickname.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </Link>
              <SignOutButton />
            </>
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
