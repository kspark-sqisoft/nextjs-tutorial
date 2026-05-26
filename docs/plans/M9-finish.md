# M9 — 마감 (shadcn / 다크모드 / i18n / View Transitions) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.

**Goal:** shadcn/ui 정식 도입(주요 컴포넌트 교체), next-themes 다크모드 토글, next-intl 한/영 라우트, 글 목록 ↔ 상세 간 View Transitions 적용. UI 마감.

**Architecture:** `[locale]` segment + next-intl middleware 가 i18n 라우팅, 인증 middleware 와 한 파일에서 합쳐진다. next-themes 는 `<html class="...">` 토글 + SSR mismatch 회피. View Transitions 는 React 19 의 `unstable_ViewTransition` + Next 15 의 navigation 통합으로 동작.

**Tech Stack:** shadcn/ui (Radix 기반), next-themes 0.4+, next-intl 3.25+, React 19 `unstable_ViewTransition`.

---

## 사전 조건

- [ ] M1~M8 완료.
- [ ] `components.json` 존재 (M1 산출물). `tailwind.config.ts`, `globals.css` 가 shadcn 호환 토큰을 받을 준비.

---

## 파일 구조

**Modify:**
- `src/app/globals.css` — shadcn 토큰 + dark variant
- `src/components/providers.tsx` — ThemeProvider + NextIntlClientProvider 래핑
- `src/middleware.ts` — next-intl + auth 가드 합치기
- 기존 form 들(`sign-up-form.tsx`, `sign-in-form.tsx`, `profile-form.tsx`, `post-form.tsx`, `comment-form.tsx`) → shadcn `Input`, `Textarea`, `Button`, `Label`, `Card`, `Form` 활용

**Create:**
- `src/i18n/config.ts`, `request.ts`, `routing.ts`
- `src/i18n/messages/ko.json`, `en.json`
- `src/components/theme-toggle.tsx`
- `src/components/language-switcher.tsx`
- `src/components/header.tsx` — 공통 헤더 (테마 토글 + 언어 토글 + 로그인/로그아웃)
- `src/components/post/post-link.tsx` — View Transitions 적용한 Link 래퍼

**Run (shadcn add):**
- `pnpm dlx shadcn@latest add button input textarea label card dialog dropdown-menu form sheet skeleton avatar tabs badge`

---

## 작업 단위 (Task) 분해

총 6 Task.

- Task 1: shadcn 토큰 + 기본 컴포넌트 add
- Task 2: next-themes Provider + ThemeToggle
- Task 3: next-intl 설정 + middleware 결합 + 메시지 파일
- Task 4: Header + LanguageSwitcher + 페이지 마운트
- Task 5: 기존 폼들 shadcn 컴포넌트로 교체
- Task 6: View Transitions 적용 + 수동 검증

---

## Task 1 — shadcn 토큰 + 컴포넌트 install

**Files:** `src/app/globals.css`(modify), 자동 생성 `src/components/ui/*`

### Steps

- [ ] **1.1 globals.css 토큰**

```css
@import "tailwindcss";

/* shadcn/ui new-york + zinc 기본 토큰 */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.5rem;
  color-scheme: light dark;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
}

html, body { height: 100%; }
body { @apply bg-[hsl(var(--background))] text-[hsl(var(--foreground))]; }
```

- [ ] **1.2 shadcn 컴포넌트 추가**

호스트에서 (`components.json` 이 이미 있어야 함):
```bash
pnpm dlx shadcn@latest add button input textarea label card dialog dropdown-menu form sheet skeleton avatar tabs badge
```

생성 결과: `src/components/ui/button.tsx`, `input.tsx`, ... 등.

- [ ] **1.3 커밋**

```bash
git add src/app/globals.css src/components/ui/
git commit -m "feat(ui): shadcn tokens + primitive components"
```

---

## Task 2 — next-themes + ThemeToggle

**Files:** `src/components/providers.tsx`(modify), `src/components/theme-toggle.tsx`

### Steps

- [ ] **2.1 ThemeProvider 추가**

```tsx
// src/components/providers.tsx
"use client";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { trpc, trpcLinks } from "@/lib/trpc-client";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [trpcClient] = useState(() => trpc.createClient({ links: trpcLinks() }));
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    </ThemeProvider>
  );
}
```

- [ ] **2.2 ThemeToggle**

```tsx
// src/components/theme-toggle.tsx
"use client";
import { useTheme } from "next-themes";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Laptop } from "lucide-react";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="테마 전환">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun className="mr-2 size-4" />라이트</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon className="mr-2 size-4" />다크</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Laptop className="mr-2 size-4" />시스템</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **2.3 커밋**

```bash
git add src/components/providers.tsx src/components/theme-toggle.tsx
git commit -m "feat(ui): next-themes provider + ThemeToggle"
```

---

## Task 3 — next-intl 설정 + 메시지 + middleware 합치기

**Files:** `src/i18n/routing.ts`, `request.ts`, `messages/{ko,en}.json`, `src/middleware.ts`(modify), `src/app/[locale]/layout.tsx`

### Steps

- [ ] **3.1 routing.ts / request.ts**

```ts
// src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ko", "en"],
  defaultLocale: "ko",
  localePrefix: "always",
});
```

```ts
// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "ko" | "en")) locale = routing.defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

- [ ] **3.2 메시지 파일 (예시 키만)**

```json
// src/i18n/messages/ko.json
{
  "nav": { "home": "홈", "write": "글쓰기", "signIn": "로그인", "signOut": "로그아웃", "bookmarks": "북마크" },
  "auth": {
    "signUp": "회원가입",
    "signIn": "로그인",
    "emailLabel": "이메일",
    "passwordLabel": "비밀번호",
    "nicknameLabel": "닉네임"
  },
  "post": { "newPost": "새 글 작성", "save": "저장", "recent": "최근 글" }
}
```

```json
// src/i18n/messages/en.json
{
  "nav": { "home": "Home", "write": "Write", "signIn": "Sign in", "signOut": "Sign out", "bookmarks": "Bookmarks" },
  "auth": {
    "signUp": "Sign up",
    "signIn": "Sign in",
    "emailLabel": "Email",
    "passwordLabel": "Password",
    "nicknameLabel": "Nickname"
  },
  "post": { "newPost": "New post", "save": "Save", "recent": "Recent posts" }
}
```

- [ ] **3.3 next.config.ts 에 next-intl 플러그인**

```ts
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// 기존 export default withNextIntl(nextConfig) 로 감싼다.
export default withNextIntl(nextConfig);
```

- [ ] **3.4 middleware 합치기**

```ts
// src/middleware.ts
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/server/auth/cookies";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED = [/^\/(ko|en)\/me(\/|$)/, /^\/(ko|en)\/posts\/new$/, /^\/(ko|en)\/posts\/.+\/edit$/, /^\/(ko|en)\/admin/];

export function middleware(req: NextRequest) {
  const res = intlMiddleware(req);
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((re) => re.test(pathname))) {
    if (!req.cookies.get(ACCESS_COOKIE)?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/ko/sign-in";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
```

- [ ] **3.5 `app/[locale]/layout.tsx`**

```tsx
// src/app/[locale]/layout.tsx
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "ko" | "en")) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
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
```

> 기존 루트 `app/layout.tsx` 는 `[locale]/layout.tsx` 가 책임지므로 최소로 둔다 (단순 `{children}` pass-through).

- [ ] **3.6 커밋**

```bash
git add src/i18n/ src/middleware.ts next.config.ts src/app/\[locale\]/layout.tsx
git commit -m "feat(i18n): next-intl ko/en routing + middleware merge"
```

---

## Task 4 — Header + LanguageSwitcher

**Files:** `src/components/header.tsx`, `src/components/language-switcher.tsx`

### Steps

- [ ] **4.1 LanguageSwitcher**

```tsx
// src/components/language-switcher.tsx
"use client";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  function switchTo(next: "ko" | "en") {
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/"));
  }
  return (
    <div className="flex gap-1 text-xs">
      <Button variant={locale === "ko" ? "default" : "ghost"} size="sm" onClick={() => switchTo("ko")}>KO</Button>
      <Button variant={locale === "en" ? "default" : "ghost"} size="sm" onClick={() => switchTo("en")}>EN</Button>
    </div>
  );
}
```

- [ ] **4.2 Header (RSC + 클라이언트 자식)**

```tsx
// src/components/header.tsx
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
        <Link href="/" className="font-semibold">📒 학습용 블로그</Link>
        <Link href="/" className="text-zinc-600 dark:text-zinc-400">{t("home")}</Link>
        {me && <Link href="/posts/new" className="text-zinc-600 dark:text-zinc-400">{t("write")}</Link>}
        {me && <Link href="/me/bookmarks" className="text-zinc-600 dark:text-zinc-400">{t("bookmarks")}</Link>}
        {me?.role === "ADMIN" && <Link href="/admin" className="text-amber-600">Admin</Link>}
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {me ? <SignOutButton /> : <Link href="/sign-in"><Button size="sm">{t("signIn")}</Button></Link>}
        </div>
      </nav>
    </header>
  );
}
```

> `Link` href 가 `/` 같은 절대 경로면 next-intl 의 `Link` 또는 `useRouter` 의 자동 locale prefix 가 동작하지 않을 수 있다. 더 안정적으로 하려면 `import { Link } from '@/i18n/navigation'` 패턴을 만들어 쓴다 (next-intl 권장). 학습 단순화로 일단 그대로.

- [ ] **4.3 커밋**

```bash
git add src/components/header.tsx src/components/language-switcher.tsx
git commit -m "feat(ui): header with theme + language toggles"
```

---

## Task 5 — 폼들을 shadcn 컴포넌트로 교체

**Files:** `src/components/auth/*`, `src/components/profile/profile-form.tsx`, `src/components/post/post-form.tsx`, `src/components/comment/comment-form.tsx`

### Steps

- [ ] **5.1 SignInForm 예시 (Input, Button, Label, Card)**

```tsx
"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { signInAction, type ActionState } from "@/server/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "..." : label}</Button>;
}

export function SignInForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState<ActionState, FormData>(signInAction, null);
  return (
    <Card>
      <CardHeader><CardTitle>{t("signIn")}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Submit label={t("signIn")} />
          {state && !state.ok && <p className="text-sm text-red-600">{state.message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
```

> 같은 패턴으로 SignUpForm, ProfileForm, CommentForm, PostForm 의 raw `<input>`/`<button>` 을 shadcn `Input`/`Button`/`Textarea`/`Label` 로 교체. PostCard 도 `Card` 로 감싼다.

- [ ] **5.2 일관성 점검 + 커밋**

```bash
pnpm typecheck
git add src/components/
git commit -m "feat(ui): adopt shadcn primitives across forms and cards"
```

---

## Task 6 — View Transitions API

**Files:** `src/components/post/post-link.tsx`, `src/components/post/post-card.tsx`(modify), `src/app/[locale]/(main)/posts/[slug]/page.tsx`(modify), `src/app/globals.css`(modify)

### Steps

- [ ] **6.1 globals.css 에 transition CSS**

```css
@layer base {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 200ms;
    animation-timing-function: ease-out;
  }
}
```

- [ ] **6.2 PostLink (Link 의 client navigation 후 View Transition 강제)**

```tsx
// src/components/post/post-link.tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

// React 19 의 unstable_ViewTransition 은 두 페이지의 같은 name 으로 layout 을 매칭한다.
// startViewTransition (Document API) 으로 navigation 을 감싸면 더 직관적.
export function PostLink({ href, viewTransitionName, children, className }: {
  href: string; viewTransitionName: string; children: React.ReactNode; className?: string;
}) {
  const router = useRouter();
  function onClick(e: React.MouseEvent) {
    if (!("startViewTransition" in document)) return; // 브라우저 미지원 — 일반 navigation.
    e.preventDefault();
    (document as Document & { startViewTransition: (cb: () => void) => void })
      .startViewTransition(() => startTransition(() => router.push(href)));
  }
  return (
    <Link href={href} onClick={onClick} className={className} style={{ viewTransitionName }}>
      {children}
    </Link>
  );
}
```

- [ ] **6.3 PostCard 에 적용**

```tsx
// src/components/post/post-card.tsx 의 Link 를 PostLink 로 교체.
import { PostLink } from "./post-link";

export function PostCard({ post }: { post: { id: string; title: string; slug: string; createdAt: Date; authorNickname: string; authorAvatarUrl: string | null } }) {
  return (
    <PostLink href={`/ko/posts/${post.slug}`} viewTransitionName={`post-${post.id}`}
      className="block rounded-lg border p-4 transition hover:bg-muted">
      <h3 className="text-lg font-semibold">{post.title}</h3>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{post.authorNickname}</span>
        <span>·</span>
        <time>{new Date(post.createdAt).toLocaleString("ko-KR")}</time>
      </div>
    </PostLink>
  );
}
```

- [ ] **6.4 상세 페이지 헤더도 같은 viewTransitionName**

```tsx
// posts/[slug]/page.tsx — header 영역
<header style={{ viewTransitionName: `post-${post.id}` }} className="mb-6">
  ...
</header>
```

- [ ] **6.5 커밋**

```bash
git add src/components/post/post-link.tsx src/components/post/post-card.tsx \
  src/app/\[locale\]/\(main\)/posts/\[slug\]/page.tsx src/app/globals.css
git commit -m "feat(ux): View Transitions API on post navigation"
```

---

## 마일스톤 종료 체크리스트

- [ ] `pnpm typecheck` 통과.
- [ ] 다크모드 토글 동작 (light/dark/system).
- [ ] `/ko/...` ↔ `/en/...` 전환 시 메시지 변경.
- [ ] 글 카드 → 상세 클릭 시 부드러운 transition (Chromium 계열에서 확인).
- [ ] 모든 폼이 shadcn 컴포넌트로 통일.

---

## 다음 단계

**M10 — 테스트 & 프로덕션 Docker** (`docs/plans/M10-test-prod.md`).

---

문서 끝.
