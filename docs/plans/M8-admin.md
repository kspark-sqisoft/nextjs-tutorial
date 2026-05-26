# M8 — 관리자 (RBAC) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.

**Goal:** `ADMIN` 역할만 접근 가능한 `/admin/users`, `/admin/posts` 두 페이지. 유저 활성/비활성 토글(비활성 시 즉시 모든 세션 revoke), 글 숨김/삭제 토글. 일반 사용자는 `/admin/*` 접근 시 404 처리.

**Architecture:** `adminProcedure` 는 M3 에서 이미 도입. middleware 는 access 쿠키 존재만 검사하고, 실제 role 확인은 admin 레이아웃의 RSC + 라우터 procedure 가 책임. RSC 페이지에서 `getCurrentUser` 로 가드. 글의 숨김(`is_hidden=true`) 은 모든 공개 라우터(`post.list`, `post.bySlug`)가 작성자/ADMIN 외에는 노출하지 않도록 한다.

---

## 사전 조건

- [ ] M1~M7 완료.
- [ ] `users.role` enum + `users.is_active` 컬럼 존재.
- [ ] `adminProcedure` 가 `src/server/trpc/trpc.ts` 에서 export 되고 있음.
- [ ] `ADMIN` 계정이 1개 이상 존재 (없으면 시드 스크립트 또는 psql 로 만든다).

---

## 파일 구조

**Create:**
- `scripts/seed-admin.ts` — `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` 환경변수 있을 때 ADMIN 1명 생성
- `src/server/trpc/routers/admin.ts`
- `src/app/[locale]/(admin)/admin/layout.tsx` — ADMIN 가드
- `src/app/[locale]/(admin)/admin/page.tsx` — 대시보드 (요약)
- `src/app/[locale]/(admin)/admin/users/page.tsx`
- `src/app/[locale]/(admin)/admin/posts/page.tsx`
- `src/components/admin/user-row.tsx`
- `src/components/admin/post-row.tsx`

**Modify:**
- `src/server/trpc/routers/_app.ts` — admin 라우터 등록
- `src/server/trpc/routers/post.ts` — `list` / `bySlug` 에 `is_hidden=false` 필터 유지 (이미 했지만 재검토)
- `src/server/auth/session.ts` — `users.is_active` 가 false 면 `rotateSession` 거부 (이미 함, 재확인)

---

## 작업 단위 (Task) 분해

총 5 Task.

- Task 1: `scripts/seed-admin.ts` + ADMIN 시드 실행
- Task 2: `admin` tRPC 라우터 (users.list/setActive, posts.list/setHidden/delete)
- Task 3: admin 라우트 가드 + 대시보드 + 페이지들
- Task 4: UserRow / PostRow (행 단위 토글 — useOptimistic)
- Task 5: 수동 검증

---

## Task 1 — ADMIN 시드

**Files:** `scripts/seed-admin.ts`, `package.json`(modify), `.env.example`(modify)

### Steps

- [ ] **1.1 `.env.example` 에 추가**

```dotenv
# 첫 실행에 사용할 ADMIN 시드 (있으면 1회 생성, 없으면 생략)
SEED_ADMIN_EMAIL=admin@blog.local
SEED_ADMIN_PASSWORD=admin1234
SEED_ADMIN_NICKNAME=admin
```

- [ ] **1.2 scripts/seed-admin.ts**

```ts
// SEED_ADMIN_* 환경변수가 모두 있고 해당 이메일이 없을 때만 ADMIN 1명 생성.
// 학습 차원에서 password 해시는 argon2 wrapper 를 그대로 사용.
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nickname = process.env.SEED_ADMIN_NICKNAME ?? "admin";
  if (!email || !password) {
    console.log("ℹ️  SEED_ADMIN_* 가 없어 ADMIN 시드를 건너뜁니다.");
    process.exit(0);
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`ℹ️  ADMIN ${email} 이미 존재 — 스킵.`);
    process.exit(0);
  }
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    email, passwordHash, nickname,
    role: "ADMIN",
    emailVerifiedAt: new Date(), // 시드 ADMIN 은 인증 메일 생략.
  });
  console.log(`✅ ADMIN ${email} 생성 완료`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **1.3 package.json scripts**

```json
"seed:admin": "tsx scripts/seed-admin.ts"
```

- [ ] **1.4 실행 + 커밋**

```bash
docker compose -f compose.dev.yml exec app pnpm seed:admin
git add scripts/seed-admin.ts package.json .env.example
git commit -m "feat(admin): seed-admin script for first ADMIN account"
```

---

## Task 2 — admin tRPC 라우터

**Files:** `src/server/trpc/routers/admin.ts`, `_app.ts`(modify)

### Steps

- [ ] **2.1 admin.ts**

```ts
import { z } from "zod";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { posts, sessions, users } from "@/server/db/schema";
import { publicUrl } from "@/server/storage/s3";

const ListInput = z.object({
  q: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().nullish(), // base64("createdAtIso|id")
});

export const adminRouter = router({
  users: router({
    list: adminProcedure
      .input(ListInput.extend({
        role: z.enum(["USER", "ADMIN"]).optional(),
        onlyInactive: z.boolean().default(false),
      }))
      .query(async ({ input }) => {
        const where = [];
        if (input.q) where.push(ilike(users.email, `%${input.q}%`));
        if (input.role) where.push(eq(users.role, input.role));
        if (input.onlyInactive) where.push(eq(users.isActive, false));
        const rows = await db
          .select({
            id: users.id, email: users.email, nickname: users.nickname,
            role: users.role, isActive: users.isActive,
            emailVerifiedAt: users.emailVerifiedAt,
            createdAt: users.createdAt, avatarKey: users.avatarKey,
          })
          .from(users)
          .where(where.length ? and(...where) : undefined)
          .orderBy(desc(users.createdAt))
          .limit(input.limit);
        return rows.map((r) => ({ ...r, avatarUrl: r.avatarKey ? publicUrl(r.avatarKey) : null }));
      }),

    setActive: adminProcedure
      .input(z.object({ userId: z.string().uuid(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id && !input.isActive) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "자기 자신을 비활성화 할 수 없습니다." });
        }
        await db.update(users).set({ isActive: input.isActive, updatedAt: new Date() }).where(eq(users.id, input.userId));
        if (!input.isActive) {
          // 즉시 강제 로그아웃 — 모든 세션 revoke.
          await db
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(and(eq(sessions.userId, input.userId), sql`${sessions.revokedAt} IS NULL`));
        }
        return { ok: true as const };
      }),
  }),

  posts: router({
    list: adminProcedure
      .input(ListInput.extend({ onlyHidden: z.boolean().default(false) }))
      .query(async ({ input }) => {
        const where = [];
        if (input.q) where.push(ilike(posts.title, `%${input.q}%`));
        if (input.onlyHidden) where.push(eq(posts.isHidden, true));
        const rows = await db
          .select({
            id: posts.id, title: posts.title, slug: posts.slug,
            isHidden: posts.isHidden, isPublished: posts.isPublished,
            createdAt: posts.createdAt, authorNickname: users.nickname, authorEmail: users.email,
          })
          .from(posts)
          .innerJoin(users, eq(users.id, posts.authorId))
          .where(where.length ? and(...where) : undefined)
          .orderBy(desc(posts.createdAt))
          .limit(input.limit);
        return rows;
      }),

    setHidden: adminProcedure
      .input(z.object({ postId: z.string().uuid(), isHidden: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.update(posts).set({ isHidden: input.isHidden, updatedAt: new Date() }).where(eq(posts.id, input.postId));
        return { ok: true as const };
      }),

    delete: adminProcedure
      .input(z.object({ postId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        await db.delete(posts).where(eq(posts.id, input.postId));
        return { ok: true as const };
      }),
  }),
});
```

- [ ] **2.2 `_app.ts` 갱신**

```ts
import { adminRouter } from "./admin";
// ...
export const appRouter = router({
  // ...
  admin: adminRouter,
});
```

- [ ] **2.3 커밋**

```bash
git add src/server/trpc/routers/admin.ts src/server/trpc/routers/_app.ts
git commit -m "feat(admin): users/posts admin trpc router"
```

---

## Task 3 — admin 라우트 가드 + 페이지

**Files:** `src/app/[locale]/(admin)/admin/layout.tsx`, `admin/page.tsx`, `users/page.tsx`, `posts/page.tsx`

### Steps

- [ ] **3.1 admin layout (가드)**

```tsx
// src/app/[locale]/(admin)/admin/layout.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  // 학습 포인트: 권한 부족은 redirect 보다 notFound 가 정보 누출이 적다.
  if (!me || me.role !== "ADMIN") return notFound();
  return (
    <div className="mx-auto flex max-w-5xl gap-6 p-8">
      <aside className="w-48 shrink-0">
        <h2 className="mb-4 text-sm font-medium text-zinc-500">관리자</h2>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/ko/admin" className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">대시보드</Link>
          <Link href="/ko/admin/users" className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">유저</Link>
          <Link href="/ko/admin/posts" className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">글</Link>
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **3.2 admin 대시보드**

```tsx
// src/app/[locale]/(admin)/admin/page.tsx
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { posts, users } from "@/server/db/schema";

export default async function AdminDashboard() {
  const [{ userCount }] = await db.select({ userCount: sql<number>`count(*)::int` }).from(users);
  const [{ postCount }] = await db.select({ postCount: sql<number>`count(*)::int` }).from(posts);
  const [{ hiddenCount }] = await db
    .select({ hiddenCount: sql<number>`count(*)::int` })
    .from(posts)
    .where(sql`is_hidden = true`);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">대시보드</h1>
      <ul className="grid grid-cols-3 gap-3 text-sm">
        <li className="rounded border p-4">유저 <strong className="block text-2xl">{userCount}</strong></li>
        <li className="rounded border p-4">글 <strong className="block text-2xl">{postCount}</strong></li>
        <li className="rounded border p-4">숨김 글 <strong className="block text-2xl">{hiddenCount}</strong></li>
      </ul>
    </div>
  );
}
```

- [ ] **3.3 유저 페이지 (RSC + UserRow 자식)**

```tsx
// src/app/[locale]/(admin)/admin/users/page.tsx
import { createCaller } from "@/server/trpc/caller";
import { UserRow } from "@/components/admin/user-row";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; onlyInactive?: string }> }) {
  const sp = await searchParams;
  const caller = await createCaller();
  const rows = await caller.admin.users.list({
    q: sp.q?.trim() || undefined,
    onlyInactive: sp.onlyInactive === "1",
  });
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">유저</h1>
      <form className="mb-4 flex gap-2 text-sm">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="이메일 검색" className="rounded border px-3 py-1" />
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyInactive" value="1" defaultChecked={sp.onlyInactive === "1"} />
          비활성만
        </label>
        <button type="submit" className="rounded border px-3 py-1">검색</button>
      </form>
      <ul className="flex flex-col divide-y">
        {rows.map((u) => <UserRow key={u.id} user={u} />)}
        {!rows.length && <li className="py-4 text-sm text-zinc-500">결과 없음</li>}
      </ul>
    </div>
  );
}
```

- [ ] **3.4 글 페이지**

```tsx
// src/app/[locale]/(admin)/admin/posts/page.tsx
import { createCaller } from "@/server/trpc/caller";
import { PostRow } from "@/components/admin/post-row";

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<{ q?: string; onlyHidden?: string }> }) {
  const sp = await searchParams;
  const caller = await createCaller();
  const rows = await caller.admin.posts.list({
    q: sp.q?.trim() || undefined,
    onlyHidden: sp.onlyHidden === "1",
  });
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">글</h1>
      <form className="mb-4 flex gap-2 text-sm">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="제목 검색" className="rounded border px-3 py-1" />
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyHidden" value="1" defaultChecked={sp.onlyHidden === "1"} />
          숨김만
        </label>
        <button type="submit" className="rounded border px-3 py-1">검색</button>
      </form>
      <ul className="flex flex-col divide-y">
        {rows.map((p) => <PostRow key={p.id} post={p} />)}
        {!rows.length && <li className="py-4 text-sm text-zinc-500">결과 없음</li>}
      </ul>
    </div>
  );
}
```

- [ ] **3.5 커밋**

```bash
git add src/app/\[locale\]/\(admin\)/
git commit -m "feat(admin): layout guard + dashboard/users/posts pages"
```

---

## Task 4 — Row 토글 (useOptimistic)

**Files:** `src/components/admin/user-row.tsx`, `post-row.tsx`

### Steps

- [ ] **4.1 UserRow**

```tsx
// src/components/admin/user-row.tsx
"use client";
import { useOptimistic, useTransition } from "react";
import Image from "next/image";
import { trpc } from "@/lib/trpc-client";

interface UserDTO {
  id: string; email: string; nickname: string;
  role: "USER" | "ADMIN"; isActive: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date; avatarUrl: string | null;
}

export function UserRow({ user }: { user: UserDTO }) {
  const setActive = trpc.admin.users.setActive.useMutation();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(user.isActive, (_s, n: boolean) => n);

  function onToggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try { await setActive.mutateAsync({ userId: user.id, isActive: next }); }
      catch (e) { console.error(e); /* RSC refresh 시 진실 */ }
    });
  }

  return (
    <li className="flex items-center gap-3 py-3 text-sm">
      {user.avatarUrl ? (
        <Image src={user.avatarUrl} alt="" width={32} height={32} unoptimized className="size-8 rounded-full object-cover" />
      ) : (
        <div className="size-8 rounded-full bg-zinc-200" />
      )}
      <div className="flex-1">
        <div className="font-medium">{user.nickname}</div>
        <div className="text-xs text-zinc-500">{user.email}</div>
      </div>
      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-900">{user.role}</span>
      {!user.emailVerifiedAt && (
        <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">미인증</span>
      )}
      <button onClick={onToggle} disabled={pending}
        className={
          "rounded border px-3 py-1 text-xs " +
          (optimistic ? "bg-white" : "bg-red-50 text-red-700 dark:bg-red-950")
        }>
        {optimistic ? "활성" : "비활성"} (토글)
      </button>
    </li>
  );
}
```

- [ ] **4.2 PostRow**

```tsx
// src/components/admin/post-row.tsx
"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";

interface PostDTO {
  id: string; title: string; slug: string;
  isHidden: boolean; isPublished: boolean;
  createdAt: Date; authorNickname: string; authorEmail: string;
}

export function PostRow({ post }: { post: PostDTO }) {
  const router = useRouter();
  const setHidden = trpc.admin.posts.setHidden.useMutation();
  const del = trpc.admin.posts.delete.useMutation();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(post.isHidden, (_s, n: boolean) => n);

  function onToggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try { await setHidden.mutateAsync({ postId: post.id, isHidden: next }); }
      catch (e) { console.error(e); }
    });
  }
  function onDelete() {
    if (!confirm(`"${post.title}" 글을 삭제하시겠어요?`)) return;
    startTransition(async () => {
      await del.mutateAsync({ postId: post.id });
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 py-3 text-sm">
      <div className="flex-1">
        <Link href={`/ko/posts/${post.slug}`} className="font-medium hover:underline">{post.title}</Link>
        <div className="text-xs text-zinc-500">{post.authorNickname} · {post.authorEmail}</div>
      </div>
      <button onClick={onToggle} disabled={pending}
        className="rounded border px-3 py-1 text-xs">
        {optimistic ? "🙈 숨김" : "👀 공개"} (토글)
      </button>
      <button onClick={onDelete} disabled={pending}
        className="rounded border border-red-300 px-3 py-1 text-xs text-red-700">
        삭제
      </button>
    </li>
  );
}
```

- [ ] **4.3 커밋**

```bash
git add src/components/admin/
git commit -m "feat(admin): UserRow + PostRow with useOptimistic toggles"
```

---

## Task 5 — 수동 검증

### Steps

- [ ] **5.1 시나리오**

1. 일반 USER 로 `/ko/admin` 접근 → 404.
2. ADMIN 로그인 → `/ko/admin/users` 진입 → 본인 카드의 "비활성" 버튼은 시도 시 BAD_REQUEST.
3. 다른 유저 비활성화 → 해당 유저는 다음 요청에서 401 + 로그인 페이지로 redirect.
4. `/ko/admin/posts` 에서 글 숨김 → 일반 사용자가 그 글을 열면 NOT_FOUND, 작성자/ADMIN 은 정상.
5. 글 삭제 → 홈에서 사라짐, 첨부도 CASCADE 로 정리.

---

## 마일스톤 종료 체크리스트

- [ ] `pnpm typecheck` 통과.
- [ ] 일반 USER 가 `/admin` 접근 시 404.
- [ ] 유저 비활성화 시 즉시 강제 로그아웃 (sessions revoke).
- [ ] 글 숨김 후 비작성자에게 NOT_FOUND.

---

## 다음 단계

**M9 — 마감 (shadcn, 다크모드, i18n, View Transitions)** (`docs/plans/M9-finish.md`).

---

문서 끝.
