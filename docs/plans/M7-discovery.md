# M7 — 탐색 (검색 + 필터 + 무한 스크롤) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.

**Goal:** 메인 피드(`/`), 태그(`/tags/[slug]`), 카테고리(`/categories/[slug]`), 검색(`/search?q=`) 네 곳 모두 동일한 `<PostFeed>` 가 무한 스크롤로 동작. PostgreSQL Full-text Search 로 한/영 검색. 서버에서 `prefetchInfiniteQuery` + `dehydrate` 로 첫 페이지를 SSR, 클라이언트는 `HydrationBoundary` → `useInfiniteQuery` 로 자연 이어가기.

**Architecture:** keyset 커서(`createdAt|id` base64) — `(createdAt, id)` 정렬 보장. 검색은 `websearch_to_tsquery('simple', ...) @@ search_tsv` 와 `ts_rank` 정렬. 첫 페이지는 RSC 에서 `createServerSideHelpers` 로 prefetch → JSON 직렬화 → 클라이언트의 `HydrationBoundary` 에 주입. `<Suspense fallback>` 으로 첫 페이지 fetch 가 늦으면 streaming.

**Tech Stack:** TanStack Query v5 (`useInfiniteQuery`, `HydrationBoundary`, `dehydrate`), tRPC v11 (`createServerSideHelpers`), IntersectionObserver.

---

## 사전 조건

- [x] M1~M6 완료.
- [x] `posts.search_tsv` GENERATED tsvector + GIN 인덱스 존재 (M5 의 마이그레이션 산출물).
- [x] `post.list` 가 keyset cursor `{ items, nextCursor }` 형태로 반환 (M5 에서 구현).

---

## 파일 구조

**Create:**
- `src/server/trpc/routers/post.ts`(modify) — `search` procedure 추가
- `src/lib/trpc-server.ts` — `createServerSideHelpers` 래퍼
- `src/components/post/post-feed.tsx` — 클라이언트 무한 스크롤
- `src/components/post/post-feed-skeleton.tsx`
- `src/app/[locale]/(main)/page.tsx` — RSC prefetch + Hydration
- `src/app/[locale]/(main)/search/page.tsx`
- `src/app/[locale]/(main)/tags/[slug]/page.tsx`
- `src/app/[locale]/(main)/categories/[slug]/page.tsx`
- `src/components/post/search-form.tsx` — 검색창

**Modify:**
- `src/components/providers.tsx` — Hydration boundary 와 호환되는 트RPC 클라이언트 셋업 점검
- `src/server/trpc/caller.ts` — 필요 시 helpers 와 caller 두 종 분리

**Add deps:** 추가 없음 (이미 모두 설치).

---

## 작업 단위 (Task) 분해

총 5 Task.

- Task 1: `post.search` procedure + (M5 의 `post.list` 가 cursor 완성 여부 점검·보정)
- Task 2: `src/lib/trpc-server.ts` — createServerSideHelpers
- Task 3: PostFeed (클라이언트 useInfiniteQuery + IntersectionObserver)
- Task 4: 홈/태그/카테고리/검색 페이지 (모두 RSC prefetch + HydrationBoundary)
- Task 5: 수동 검증

---

## Task 1 — `post.search` procedure + list cursor 점검

**Files:** `src/server/trpc/routers/post.ts`(modify)

### Steps

- [x] **1.1 search procedure 추가**

```ts
import { sql } from "drizzle-orm";
// post 라우터 안에 추가:
search: publicProcedure
  .input(z.object({
    q: z.string().min(1).max(80),
    limit: z.number().int().min(1).max(50).default(10),
    cursor: z.string().nullish(),
  }))
  .query(async ({ input }) => {
    // websearch_to_tsquery 는 "단어 단어" 또는 "OR" / 따옴표 등 자연어 문법을 지원.
    // 학습 포인트: 'simple' configuration 은 stemming 없이 토큰화만 — 한국어/영어 혼용에 적합.
    const tsq = sql`websearch_to_tsquery('simple', ${input.q})`;
    // cursor: base64("rank|createdAtIso|id")
    let cursorClause = sql``;
    if (input.cursor) {
      const decoded = Buffer.from(input.cursor, "base64").toString("utf8");
      const [rank, iso, id] = decoded.split("|");
      cursorClause = sql`AND (
        ts_rank(p.search_tsv, ${tsq}), p.created_at, p.id
      ) < (${Number(rank)}::float4, ${iso}::timestamptz, ${id}::uuid)`;
    }
    const rows = await db.execute<{
      id: string; title: string; slug: string; created_at: Date;
      author_nickname: string; author_avatar_key: string | null;
      rank: number;
    }>(sql`
      SELECT
        p.id, p.title, p.slug, p.created_at,
        u.nickname AS author_nickname, u.avatar_key AS author_avatar_key,
        ts_rank(p.search_tsv, ${tsq}) AS rank
      FROM posts p
      INNER JOIN users u ON u.id = p.author_id
      WHERE p.is_hidden = false
        AND p.is_published = true
        AND p.search_tsv @@ ${tsq}
        ${cursorClause}
      ORDER BY ts_rank(p.search_tsv, ${tsq}) DESC, p.created_at DESC, p.id DESC
      LIMIT ${input.limit + 1}
    `);
    const arr = Array.from(rows);
    const items = arr.slice(0, input.limit).map((r) => ({
      id: r.id, title: r.title, slug: r.slug,
      createdAt: r.created_at,
      authorNickname: r.author_nickname,
      authorAvatarUrl: r.author_avatar_key ? publicUrl(r.author_avatar_key) : null,
    }));
    const next = arr[input.limit];
    const nextCursor = next
      ? Buffer.from(`${next.rank}|${next.created_at.toISOString()}|${next.id}`).toString("base64")
      : null;
    return { items, nextCursor };
  }),
```

- [x] **1.2 list 반환 형태 점검**

`post.list` 가 `{ items: [...], nextCursor: string|null }` 형태인지 확인. M5 에서 구현했음. 카드 표시에 필요한 필드(`id, title, slug, createdAt, authorNickname, authorAvatarUrl`) 가 모두 들어있어야 PostFeed 가 그대로 사용 가능. 부족하면 보강.

- [x] **1.3 커밋**

```bash
git add src/server/trpc/routers/post.ts
git commit -m "feat(post): full-text search procedure with keyset pagination"
```

---

## Task 2 — `createServerSideHelpers` 래퍼

**Files:** `src/lib/trpc-server.ts`

### Steps

- [x] **2.1 trpc-server.ts**

```ts
// RSC 에서 prefetch 후 dehydrate 까지 가능한 helpers.
// 학습 포인트: trpc/react-query 의 createServerSideHelpers 는
// 내부적으로 QueryClient 를 만들어 server-side fetch 결과를 query cache 에 채워준다.
import "server-only";
import { createServerSideHelpers } from "@trpc/react-query/server";
import superjson from "superjson";
import { headers as nextHeaders } from "next/headers";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";

export async function getTrpcHelpers() {
  const h = await nextHeaders();
  return createServerSideHelpers({
    router: appRouter,
    ctx: await createContext({
      req: new Request("http://internal/", { headers: h }),
      resHeaders: new Headers(),
    } as unknown as Parameters<typeof createContext>[0]),
    transformer: superjson,
  });
}
```

- [x] **2.2 Providers 보정 — HydrationBoundary 호환 확인**

`src/components/providers.tsx` 가 `QueryClientProvider` 를 그대로 가지고 있다면 충분. HydrationBoundary 는 `@tanstack/react-query` 에서 직접 import.

- [x] **2.3 커밋**

```bash
git add src/lib/trpc-server.ts
git commit -m "feat(trpc): createServerSideHelpers wrapper for RSC prefetch"
```

---

## Task 3 — PostFeed (useInfiniteQuery + IntersectionObserver)

**Files:** `src/components/post/post-feed.tsx`, `post-feed-skeleton.tsx`

### Steps

- [x] **3.1 PostFeedSkeleton**

```tsx
// src/components/post/post-feed-skeleton.tsx
export function PostFeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}
```

- [x] **3.2 PostFeed**

```tsx
// src/components/post/post-feed.tsx
"use client";
// 학습 포인트:
//  - useInfiniteQuery 의 getNextPageParam 으로 cursor 페이지네이션.
//  - IntersectionObserver 로 sentinel 가시 시 fetchNextPage.
//  - 입력 prop 으로 source 를 'list' | 'search' | 'tag' | 'category' 로 분기.
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc-client";
import { PostCard } from "./post-card";

type FeedSource =
  | { kind: "list"; tagSlug?: string; categorySlug?: string }
  | { kind: "search"; q: string };

export function PostFeed({ source, initialLimit = 10 }: { source: FeedSource; initialLimit?: number }) {
  const sentinel = useRef<HTMLDivElement | null>(null);

  // 단일 컴포넌트에서 두 가지 query 를 분기하려고 conditional hook 을 쓰면 안 되므로,
  // 각 케이스에 대응하는 query 를 모두 호출하되 enabled 로 제어한다.
  const listQ = trpc.post.list.useInfiniteQuery(
    {
      limit: initialLimit,
      tagSlug: source.kind === "list" ? source.tagSlug ?? null : null,
      categorySlug: source.kind === "list" ? source.categorySlug ?? null : null,
    },
    {
      enabled: source.kind === "list",
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      initialCursor: undefined,
    } as Parameters<typeof trpc.post.list.useInfiniteQuery>[1],
  );

  const searchQ = trpc.post.search.useInfiniteQuery(
    { q: source.kind === "search" ? source.q : "", limit: initialLimit },
    {
      enabled: source.kind === "search",
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      initialCursor: undefined,
    } as Parameters<typeof trpc.post.search.useInfiniteQuery>[1],
  );

  const q = source.kind === "search" ? searchQ : listQ;

  useEffect(() => {
    if (!sentinel.current) return;
    const el = sentinel.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
            q.fetchNextPage();
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage, q]);

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {items.map((p) => <PostCard key={p.id} post={p} />)}
      {!items.length && !q.isLoading && (
        <p className="text-sm text-zinc-500">결과가 없습니다.</p>
      )}
      <div ref={sentinel} className="h-6" />
      {q.isFetchingNextPage && (
        <p className="text-center text-xs text-zinc-400">더 불러오는 중…</p>
      )}
      {!q.hasNextPage && items.length > 0 && (
        <p className="text-center text-xs text-zinc-400">— 끝 —</p>
      )}
    </div>
  );
}
```

- [x] **3.3 커밋**

```bash
git add src/components/post/post-feed.tsx src/components/post/post-feed-skeleton.tsx
git commit -m "feat(feed): PostFeed with useInfiniteQuery + IntersectionObserver"
```

---

## Task 4 — RSC prefetch + HydrationBoundary 페이지들

**Files:** `src/app/[locale]/(main)/page.tsx`(modify), `search/page.tsx`, `tags/[slug]/page.tsx`, `categories/[slug]/page.tsx`, `src/components/post/search-form.tsx`

### Steps

- [x] **4.1 홈 (`/[locale]`) — list infinite prefetch**

```tsx
// src/app/[locale]/(main)/page.tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import Link from "next/link";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";

export default async function HomePage() {
  const helpers = await getTrpcHelpers();
  await helpers.post.list.prefetchInfinite({ limit: 10, tagSlug: null, categorySlug: null });
  const state = dehydrate(helpers.queryClient);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">최근 글</h1>
        <Link href="/ko/posts/new"
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          글쓰기
        </Link>
      </div>
      <HydrationBoundary state={state}>
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeed source={{ kind: "list" }} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
```

- [x] **4.2 search 페이지**

```tsx
// src/app/[locale]/(main)/search/page.tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";
import { SearchForm } from "@/components/post/search-form";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  let state = undefined as ReturnType<typeof dehydrate> | undefined;
  if (query) {
    const helpers = await getTrpcHelpers();
    await helpers.post.search.prefetchInfinite({ q: query, limit: 10 });
    state = dehydrate(helpers.queryClient);
  }
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-4 text-2xl font-semibold">검색</h1>
      <SearchForm initial={query} />
      {!query ? (
        <p className="mt-6 text-sm text-zinc-500">검색어를 입력해주세요.</p>
      ) : (
        <div className="mt-6">
          <HydrationBoundary state={state!}>
            <Suspense fallback={<PostFeedSkeleton />}>
              <PostFeed source={{ kind: "search", q: query }} />
            </Suspense>
          </HydrationBoundary>
        </div>
      )}
    </main>
  );
}
```

- [x] **4.3 SearchForm**

```tsx
// src/components/post/search-form.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ q });
    router.push(`/ko/search?${params.toString()}`);
  }
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색어…"
        className="flex-1 rounded border px-3 py-2 text-sm" />
      <button type="submit"
        className="rounded bg-zinc-900 px-4 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
        검색
      </button>
    </form>
  );
}
```

- [x] **4.4 태그 / 카테고리 페이지**

```tsx
// src/app/[locale]/(main)/tags/[slug]/page.tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const helpers = await getTrpcHelpers();
  await helpers.post.list.prefetchInfinite({ limit: 10, tagSlug: slug, categorySlug: null });
  const state = dehydrate(helpers.queryClient);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">#{slug}</h1>
      <HydrationBoundary state={state}>
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeed source={{ kind: "list", tagSlug: slug }} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
```

```tsx
// src/app/[locale]/(main)/categories/[slug]/page.tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const helpers = await getTrpcHelpers();
  await helpers.post.list.prefetchInfinite({ limit: 10, tagSlug: null, categorySlug: slug });
  const state = dehydrate(helpers.queryClient);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">📁 {slug}</h1>
      <HydrationBoundary state={state}>
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeed source={{ kind: "list", categorySlug: slug }} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
```

- [x] **4.5 커밋**

```bash
git add src/app/\[locale\]/\(main\)/page.tsx \
  src/app/\[locale\]/\(main\)/search/page.tsx \
  src/app/\[locale\]/\(main\)/tags/ \
  src/app/\[locale\]/\(main\)/categories/ \
  src/components/post/search-form.tsx
git commit -m "feat(feed): SSR prefetch + HydrationBoundary on home/tags/categories/search"
```

---

## Task 5 — 수동 검증

### Steps

- [x] **5.1 데이터 시드 — 15개 이상 글 작성**

브라우저에서 직접 또는 SQL 로 빠르게:
```sql
INSERT INTO posts (author_id, title, slug, content_json, content_text)
SELECT
  (SELECT id FROM users LIMIT 1),
  '테스트 글 ' || g, 'test-post-' || g,
  jsonb_build_object('type','doc','content', jsonb_build_array(jsonb_build_object('type','paragraph','content', jsonb_build_array(jsonb_build_object('type','text','text','본문 ' || g))))),
  '본문 ' || g
FROM generate_series(1, 20) AS g;
```

- [x] **5.2 시나리오**

1. `/ko` 진입 → 첫 10개 SSR 노출 → 스크롤 → "더 불러오는 중…" → 추가 노출 → "끝".
2. `/ko/search?q=본문` → 검색 결과 노출. 다른 키워드는 빈 결과.
3. `/ko/tags/<slug>` → 해당 태그 글만.
4. `/ko/categories/general` → 카테고리 필터.
5. DevTools Network: 첫 진입 시 첫 페이지의 fetch 가 RSC 응답에 포함, 이후 페이지부터 클라이언트의 `/api/trpc/post.list` 호출.
6. 검색의 한/영 혼합 키워드 확인.

---

## 마일스톤 종료 체크리스트

- [x] `pnpm typecheck` 통과.
- [x] 4개 페이지 모두 무한 스크롤 동작.
- [x] 검색 결과 정합성 (한국어/영어).
- [x] DevTools 에서 prefetch + hydration 패턴 관찰.

---

## 다음 단계

**M8 — 관리자 (RBAC + 관리 페이지)** (`docs/plans/M8-admin.md`).

---

문서 끝.
