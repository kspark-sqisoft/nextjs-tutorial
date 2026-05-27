# M9 ??留덇컧 (shadcn / ?ㅽ겕紐⑤뱶 / i18n / View Transitions) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` ?먮뒗 `superpowers:executing-plans`.

**Goal:** shadcn/ui ?뺤떇 ?꾩엯(二쇱슂 而댄룷?뚰듃 援먯껜), next-themes ?ㅽ겕紐⑤뱶 ?좉?, next-intl ?????쇱슦?? 湲 紐⑸줉 ???곸꽭 媛?View Transitions ?곸슜. UI 留덇컧.

**Architecture:** `[locale]` segment + next-intl middleware 媛 i18n ?쇱슦?? ?몄쬆 middleware ? ???뚯씪?먯꽌 ?⑹퀜吏꾨떎. next-themes ??`<html class="...">` ?좉? + SSR mismatch ?뚰뵾. View Transitions ??React 19 ??`unstable_ViewTransition` + Next 15 ??navigation ?듯빀?쇰줈 ?숈옉.

**Tech Stack:** shadcn/ui (Radix 湲곕컲), next-themes 0.4+, next-intl 3.25+, React 19 `unstable_ViewTransition`.

---

## ?ъ쟾 議곌굔

- [x] M1~M8 ?꾨즺.
- [x] `components.json` 議댁옱 (M1 ?곗텧臾?. `tailwind.config.ts`, `globals.css` 媛 shadcn ?명솚 ?좏겙??諛쏆쓣 以鍮?

---

## ?뚯씪 援ъ“

**Modify:**
- `src/app/globals.css` ??shadcn ?좏겙 + dark variant
- `src/components/providers.tsx` ??ThemeProvider + NextIntlClientProvider ?섑븨
- `src/middleware.ts` ??next-intl + auth 媛???⑹튂湲?- 湲곗〈 form ??`sign-up-form.tsx`, `sign-in-form.tsx`, `profile-form.tsx`, `post-form.tsx`, `comment-form.tsx`) ??shadcn `Input`, `Textarea`, `Button`, `Label`, `Card`, `Form` ?쒖슜

**Create:**
- `src/i18n/config.ts`, `request.ts`, `routing.ts`
- `src/i18n/messages/ko.json`, `en.json`
- `src/components/theme-toggle.tsx`
- `src/components/language-switcher.tsx`
- `src/components/header.tsx` ??怨듯넻 ?ㅻ뜑 (?뚮쭏 ?좉? + ?몄뼱 ?좉? + 濡쒓렇??濡쒓렇?꾩썐)
- `src/components/post/post-link.tsx` ??View Transitions ?곸슜??Link ?섑띁

**Run (shadcn add):**
- `pnpm dlx shadcn@latest add button input textarea label card dialog dropdown-menu form sheet skeleton avatar tabs badge`

---

## ?묒뾽 ?⑥쐞 (Task) 遺꾪빐

珥?6 Task.

- Task 1: shadcn ?좏겙 + 湲곕낯 而댄룷?뚰듃 add
- Task 2: next-themes Provider + ThemeToggle
- Task 3: next-intl ?ㅼ젙 + middleware 寃고빀 + 硫붿떆吏 ?뚯씪
- Task 4: Header + LanguageSwitcher + ?섏씠吏 留덉슫??- Task 5: 湲곗〈 ?쇰뱾 shadcn 而댄룷?뚰듃濡?援먯껜
- Task 6: View Transitions ?곸슜 + ?섎룞 寃利?
---

## Task 1 ??shadcn ?좏겙 + 而댄룷?뚰듃 install

**Files:** `src/app/globals.css`(modify), ?먮룞 ?앹꽦 `src/components/ui/*`

### Steps

- [x] **1.1 globals.css ?좏겙**

```css
@import "tailwindcss";

/* shadcn/ui new-york + zinc 湲곕낯 ?좏겙 */
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

- [x] **1.2 shadcn 而댄룷?뚰듃 異붽?**

?몄뒪?몄뿉??(`components.json` ???대? ?덉뼱????:
```bash
pnpm dlx shadcn@latest add button input textarea label card dialog dropdown-menu form sheet skeleton avatar tabs badge
```

?앹꽦 寃곌낵: `src/components/ui/button.tsx`, `input.tsx`, ... ??

- [x] **1.3 而ㅻ컠**

```bash
git add src/app/globals.css src/components/ui/
git commit -m "feat(ui): shadcn tokens + primitive components"
```

---

## Task 2 ??next-themes + ThemeToggle

**Files:** `src/components/providers.tsx`(modify), `src/components/theme-toggle.tsx`

### Steps

- [x] **2.1 ThemeProvider 異붽?**

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

- [x] **2.2 ThemeToggle**

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
        <Button variant="ghost" size="icon" aria-label="?뚮쭏 ?꾪솚">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun className="mr-2 size-4" />?쇱씠??/DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon className="mr-2 size-4" />?ㅽ겕</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Laptop className="mr-2 size-4" />?쒖뒪??/DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [x] **2.3 而ㅻ컠**

```bash
git add src/components/providers.tsx src/components/theme-toggle.tsx
git commit -m "feat(ui): next-themes provider + ThemeToggle"
```

---

## Task 3 ??next-intl ?ㅼ젙 + 硫붿떆吏 + middleware ?⑹튂湲?
**Files:** `src/i18n/routing.ts`, `request.ts`, `messages/{ko,en}.json`, `src/middleware.ts`(modify), `src/app/[locale]/layout.tsx`

### Steps

- [x] **3.1 routing.ts / request.ts**

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

- [x] **3.2 硫붿떆吏 ?뚯씪 (?덉떆 ?ㅻ쭔)**

```json
// src/i18n/messages/ko.json
{
  "nav": { "home": "??, "write": "湲?곌린", "signIn": "濡쒓렇??, "signOut": "濡쒓렇?꾩썐", "bookmarks": "遺곷쭏?? },
  "auth": {
    "signUp": "?뚯썝媛??,
    "signIn": "濡쒓렇??,
    "emailLabel": "?대찓??,
    "passwordLabel": "鍮꾨?踰덊샇",
    "nicknameLabel": "?됰꽕??
  },
  "post": { "newPost": "??湲 ?묒꽦", "save": "???, "recent": "理쒓렐 湲" }
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

- [x] **3.3 next.config.ts ??next-intl ?뚮윭洹몄씤**

```ts
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// 湲곗〈 export default withNextIntl(nextConfig) 濡?媛먯떬??
export default withNextIntl(nextConfig);
```

- [x] **3.4 middleware ?⑹튂湲?*

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

- [x] **3.5 `app/[locale]/layout.tsx`**

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

> 湲곗〈 猷⑦듃 `app/layout.tsx` ??`[locale]/layout.tsx` 媛 梨낆엫吏誘濡?理쒖냼濡??붾떎 (?⑥닚 `{children}` pass-through).

- [x] **3.6 而ㅻ컠**

```bash
git add src/i18n/ src/middleware.ts next.config.ts src/app/\[locale\]/layout.tsx
git commit -m "feat(i18n): next-intl ko/en routing + middleware merge"
```

---

## Task 4 ??Header + LanguageSwitcher

**Files:** `src/components/header.tsx`, `src/components/language-switcher.tsx`

### Steps

- [x] **4.1 LanguageSwitcher**

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

- [x] **4.2 Header (RSC + ?대씪?댁뼵???먯떇)**

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
        <Link href="/" className="font-semibold">?뱬 ?숈뒿??釉붾줈洹?/Link>
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

> `Link` href 媛 `/` 媛숈? ?덈? 寃쎈줈硫?next-intl ??`Link` ?먮뒗 `useRouter` ???먮룞 locale prefix 媛 ?숈옉?섏? ?딆쓣 ???덈떎. ???덉젙?곸쑝濡??섎젮硫?`import { Link } from '@/i18n/navigation'` ?⑦꽩??留뚮뱾???대떎 (next-intl 沅뚯옣). ?숈뒿 ?⑥닚?붾줈 ?쇰떒 洹몃?濡?

- [x] **4.3 而ㅻ컠**

```bash
git add src/components/header.tsx src/components/language-switcher.tsx
git commit -m "feat(ui): header with theme + language toggles"
```

---

## Task 5 ???쇰뱾??shadcn 而댄룷?뚰듃濡?援먯껜

**Files:** `src/components/auth/*`, `src/components/profile/profile-form.tsx`, `src/components/post/post-form.tsx`, `src/components/comment/comment-form.tsx`

### Steps

- [x] **5.1 SignInForm ?덉떆 (Input, Button, Label, Card)**

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

> 媛숈? ?⑦꽩?쇰줈 SignUpForm, ProfileForm, CommentForm, PostForm ??raw `<input>`/`<button>` ??shadcn `Input`/`Button`/`Textarea`/`Label` 濡?援먯껜. PostCard ??`Card` 濡?媛먯떬??

- [x] **5.2 ?쇨????먭? + 而ㅻ컠**

```bash
pnpm typecheck
git add src/components/
git commit -m "feat(ui): adopt shadcn primitives across forms and cards"
```

---

## Task 6 ??View Transitions API

**Files:** `src/components/post/post-link.tsx`, `src/components/post/post-card.tsx`(modify), `src/app/[locale]/(main)/posts/[slug]/page.tsx`(modify), `src/app/globals.css`(modify)

### Steps

- [x] **6.1 globals.css ??transition CSS**

```css
@layer base {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 200ms;
    animation-timing-function: ease-out;
  }
}
```

- [x] **6.2 PostLink (Link ??client navigation ??View Transition 媛뺤젣)**

```tsx
// src/components/post/post-link.tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

// React 19 ??unstable_ViewTransition ? ???섏씠吏??媛숈? name ?쇰줈 layout ??留ㅼ묶?쒕떎.
// startViewTransition (Document API) ?쇰줈 navigation ??媛먯떥硫???吏곴???
export function PostLink({ href, viewTransitionName, children, className }: {
  href: string; viewTransitionName: string; children: React.ReactNode; className?: string;
}) {
  const router = useRouter();
  function onClick(e: React.MouseEvent) {
    if (!("startViewTransition" in document)) return; // 釉뚮씪?곗? 誘몄??????쇰컲 navigation.
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

- [x] **6.3 PostCard ???곸슜**

```tsx
// src/components/post/post-card.tsx ??Link 瑜?PostLink 濡?援먯껜.
import { PostLink } from "./post-link";

export function PostCard({ post }: { post: { id: string; title: string; slug: string; createdAt: Date; authorNickname: string; authorAvatarUrl: string | null } }) {
  return (
    <PostLink href={`/ko/posts/${post.slug}`} viewTransitionName={`post-${post.id}`}
      className="block rounded-lg border p-4 transition hover:bg-muted">
      <h3 className="text-lg font-semibold">{post.title}</h3>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{post.authorNickname}</span>
        <span>쨌</span>
        <time>{new Date(post.createdAt).toLocaleString("ko-KR")}</time>
      </div>
    </PostLink>
  );
}
```

- [x] **6.4 ?곸꽭 ?섏씠吏 ?ㅻ뜑??媛숈? viewTransitionName**

```tsx
// posts/[slug]/page.tsx ??header ?곸뿭
<header style={{ viewTransitionName: `post-${post.id}` }} className="mb-6">
  ...
</header>
```

- [x] **6.5 而ㅻ컠**

```bash
git add src/components/post/post-link.tsx src/components/post/post-card.tsx \
  src/app/\[locale\]/\(main\)/posts/\[slug\]/page.tsx src/app/globals.css
git commit -m "feat(ux): View Transitions API on post navigation"
```

---

## 留덉씪?ㅽ넠 醫낅즺 泥댄겕由ъ뒪??
- [x] `pnpm typecheck` ?듦낵.
- [x] ?ㅽ겕紐⑤뱶 ?좉? ?숈옉 (light/dark/system).
- [x] `/ko/...` ??`/en/...` ?꾪솚 ??硫붿떆吏 蹂寃?
- [x] 湲 移대뱶 ???곸꽭 ?대┃ ??遺?쒕윭??transition (Chromium 怨꾩뿴?먯꽌 ?뺤씤).
- [x] 紐⑤뱺 ?쇱씠 shadcn 而댄룷?뚰듃濡??듭씪.

---

## ?ㅼ쓬 ?④퀎

**M10 ???뚯뒪??& ?꾨줈?뺤뀡 Docker** (`docs/plans/M10-test-prod.md`).

---

臾몄꽌 ??

