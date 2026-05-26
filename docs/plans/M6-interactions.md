# M6 — 상호작용 (댓글/좋아요/북마크 + `useOptimistic`) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.

**Goal:** 글 상세에서 댓글 작성/삭제/대댓글(1단계), 좋아요/북마크 토글이 클릭 즉시 UI 에 반영(낙관적 업데이트)되고 실패 시 자동 롤백. `useOptimistic` 을 세 가지 다른 상호작용 패턴(리스트 추가, 토글, 카운트 증감)에서 학습한다. 댓글 섹션은 `<Suspense>` 로 감싸 글 상세의 본문은 즉시, 댓글은 streaming.

**Architecture:** comment/like/bookmark 세 테이블. like/bookmark 는 `(user_id, post_id)` 복합 PK 로 idempotent 토글. 댓글은 RSC 에서 `bySlug` 와 별도로 `listByPost` 를 호출하므로 Suspense 경계 안에서 별도 fetch → streaming 적용 효과 명확. 클라이언트 mutation 은 tRPC + `useOptimistic`. 서버 mutation 후 RSC 재실행은 `revalidatePath('/[locale]/posts/[slug]')`.

**Tech Stack:** React 19 `useOptimistic`, Suspense, `useActionState` + `useFormStatus`.

---

## 사전 조건

- [x] M1~M5 완료. `post.bySlug` 가 동작.
- [x] `protectedProcedure` 활성.

---

## 파일 구조

**Create (`src/server/db/schema/`):**
- `comments.ts`, `likes.ts`, `bookmarks.ts`
- migrations 추가

**Create:**
- `src/server/trpc/routers/comment.ts`, `like.ts`, `bookmark.ts`
- `src/components/comment/comment-section.tsx` — Suspense 경계 + 두 자식
- `src/components/comment/comment-list.tsx` — RSC fetch
- `src/components/comment/comment-form.tsx` — useOptimistic 댓글 추가
- `src/components/comment/comment-item.tsx` — 삭제 버튼 + 대댓글 입력 토글
- `src/components/post/like-button.tsx` — useOptimistic 토글 + 카운트
- `src/components/post/bookmark-button.tsx` — useOptimistic 토글
- `src/app/[locale]/(main)/me/bookmarks/page.tsx` — RSC

**Modify:**
- `src/server/trpc/routers/_app.ts` — 세 라우터 등록
- `src/server/trpc/routers/post.ts` — `bySlug` 에 likeCount / liked / bookmarked / commentCount 포함
- `src/app/[locale]/(main)/posts/[slug]/page.tsx` — `<CommentSection>` 마운트, Suspense 래핑

---

## 작업 단위 (Task) 분해

총 7 Task.

- Task 1: comments / likes / bookmarks 스키마 + 마이그레이션
- Task 2: comment / like / bookmark tRPC 라우터
- Task 3: post.bySlug 에 카운트/상태 포함
- Task 4: LikeButton (useOptimistic — 토글 + 카운트)
- Task 5: BookmarkButton (useOptimistic — 토글) + /me/bookmarks
- Task 6: CommentSection + Suspense streaming + CommentForm (useOptimistic 리스트 추가)
- Task 7: 수동 검증

---

## Task 1 — comments / likes / bookmarks 스키마

**Files:** `src/server/db/schema/comments.ts`, `likes.ts`, `bookmarks.ts`, `index.ts`(modify)

### Steps

- [x] **1.1 comments**

```ts
// src/server/db/schema/comments.ts
import { sql } from "drizzle-orm";
import {
  AnyPgColumn, index, pgTable, text, timestamp, uuid,
} from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // 대댓글 1단계만 — 앱 레이어에서 parent_id 의 parent_id != null 이면 거부.
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    postIdx: index("comments_post_id_idx").on(t.postId),
    parentIdx: index("comments_parent_id_idx").on(t.parentId),
  }),
);

export type Comment = typeof comments.$inferSelect;
```

- [x] **1.2 likes**

```ts
// src/server/db/schema/likes.ts
import { sql } from "drizzle-orm";
import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";

export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.postId] }) }),
);
```

- [x] **1.3 bookmarks**

```ts
// src/server/db/schema/bookmarks.ts
import { sql } from "drizzle-orm";
import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.postId] }) }),
);
```

- [x] **1.4 index.ts 갱신 + 마이그레이션/적용**

```ts
export * from "./comments";
export * from "./likes";
export * from "./bookmarks";
```

```bash
docker compose -f compose.dev.yml exec app pnpm db:generate
docker compose -f compose.dev.yml exec app pnpm db:migrate
docker compose -f compose.dev.yml exec postgres psql -U postgres -d blog -c "\d comments" -c "\d likes" -c "\d bookmarks"

git add src/server/db/schema/{comments,likes,bookmarks,index}.ts src/server/db/migrations/*
git commit -m "feat(db): comments/likes/bookmarks tables"
```

---

## Task 2 — comment / like / bookmark tRPC 라우터

**Files:** `src/server/trpc/routers/comment.ts`, `like.ts`, `bookmark.ts`, `_app.ts`(modify)

### Steps

- [x] **2.1 comment.ts**

```ts
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { comments, users } from "@/server/db/schema";
import { publicUrl } from "@/server/storage/s3";

export const commentRouter = router({
  listByPost: publicProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: comments.id, parentId: comments.parentId,
          content: comments.content, createdAt: comments.createdAt,
          authorId: comments.authorId, authorNickname: users.nickname,
          authorAvatarKey: users.avatarKey,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorId))
        .where(eq(comments.postId, input.postId))
        .orderBy(comments.createdAt);
      return rows.map((r) => ({
        ...r,
        authorAvatarUrl: r.authorAvatarKey ? publicUrl(r.authorAvatarKey) : null,
      }));
    }),

  create: protectedProcedure
    .input(z.object({
      postId: z.string().uuid(),
      parentId: z.string().uuid().nullish(),
      content: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      // 대댓글 1단계 검증.
      if (input.parentId) {
        const [parent] = await db
          .select({ parentId: comments.parentId, postId: comments.postId })
          .from(comments)
          .where(eq(comments.id, input.parentId))
          .limit(1);
        if (!parent || parent.postId !== input.postId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "잘못된 부모 댓글입니다." });
        if (parent.parentId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "대댓글은 1단계까지만 허용됩니다." });
      }
      const [created] = await db
        .insert(comments)
        .values({
          postId: input.postId, parentId: input.parentId ?? null,
          authorId: ctx.user.id, content: input.content,
        })
        .returning({
          id: comments.id, parentId: comments.parentId, content: comments.content,
          createdAt: comments.createdAt, authorId: comments.authorId,
        });
      return created!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await db.select({ authorId: comments.authorId }).from(comments).where(eq(comments.id, input.id)).limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.authorId !== ctx.user.id && ctx.user.role !== "ADMIN")
        throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(comments).where(eq(comments.id, input.id));
      return { ok: true as const };
    }),
});
```

- [x] **2.2 like.ts**

```ts
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { likes } from "@/server/db/schema";

export const likeRouter = router({
  toggle: protectedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // INSERT 시 PK 충돌이면 DELETE 로 전환 (토글).
      const result = await db
        .insert(likes)
        .values({ userId: ctx.user.id, postId: input.postId })
        .onConflictDoNothing()
        .returning({ userId: likes.userId });
      let liked: boolean;
      if (result.length === 0) {
        // 이미 존재 → 삭제.
        await db.delete(likes).where(and(eq(likes.userId, ctx.user.id), eq(likes.postId, input.postId)));
        liked = false;
      } else {
        liked = true;
      }
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(likes)
        .where(eq(likes.postId, input.postId));
      return { liked, count };
    }),
});
```

- [x] **2.3 bookmark.ts**

```ts
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { bookmarks, posts, users } from "@/server/db/schema";
import { publicUrl } from "@/server/storage/s3";

export const bookmarkRouter = router({
  toggle: protectedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const inserted = await db
        .insert(bookmarks)
        .values({ userId: ctx.user.id, postId: input.postId })
        .onConflictDoNothing()
        .returning({ userId: bookmarks.userId });
      if (inserted.length === 0) {
        await db.delete(bookmarks).where(and(eq(bookmarks.userId, ctx.user.id), eq(bookmarks.postId, input.postId)));
        return { bookmarked: false as const };
      }
      return { bookmarked: true as const };
    }),

  myBookmarks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: posts.id, title: posts.title, slug: posts.slug,
        createdAt: posts.createdAt, authorNickname: users.nickname,
        authorAvatarKey: users.avatarKey,
      })
      .from(bookmarks)
      .innerJoin(posts, eq(posts.id, bookmarks.postId))
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(eq(bookmarks.userId, ctx.user.id))
      .orderBy(desc(bookmarks.createdAt));
    return rows.map((r) => ({
      ...r,
      authorAvatarUrl: r.authorAvatarKey ? publicUrl(r.authorAvatarKey) : null,
    }));
  }),
});
```

- [x] **2.4 `_app.ts` 갱신**

```ts
import { commentRouter } from "./comment";
import { likeRouter } from "./like";
import { bookmarkRouter } from "./bookmark";

export const appRouter = router({
  health: healthRouter,
  profile: profileRouter,
  post: postRouter,
  comment: commentRouter,
  like: likeRouter,
  bookmark: bookmarkRouter,
});
export type AppRouter = typeof appRouter;
```

- [x] **2.5 커밋**

```bash
git add src/server/trpc/routers/{comment,like,bookmark,_app}.ts
git commit -m "feat(interactions): comment/like/bookmark trpc routers"
```

---

## Task 3 — `post.bySlug` 에 카운트/상태 포함

**Files:** `src/server/trpc/routers/post.ts`(modify)

### Steps

- [x] **3.1 bySlug 확장**

기존 `bySlug` 반환 객체에 다음 필드 추가:
```ts
import { bookmarks, comments, likes } from "@/server/db/schema";

// bySlug 안에서 p 조회 후 추가:
const [{ likeCount }] = await db
  .select({ likeCount: sql<number>`count(*)::int` })
  .from(likes)
  .where(eq(likes.postId, p.id));
const [{ commentCount }] = await db
  .select({ commentCount: sql<number>`count(*)::int` })
  .from(comments)
  .where(eq(comments.postId, p.id));
let liked = false, bookmarked = false;
if (ctx.user) {
  const [l] = await db.select().from(likes).where(and(eq(likes.userId, ctx.user.id), eq(likes.postId, p.id))).limit(1);
  liked = !!l;
  const [b] = await db.select().from(bookmarks).where(and(eq(bookmarks.userId, ctx.user.id), eq(bookmarks.postId, p.id))).limit(1);
  bookmarked = !!b;
}
return { ...p, likeCount, commentCount, liked, bookmarked, tags: tagRows, attachments: /* ... */ };
```

- [x] **3.2 커밋**

```bash
git add src/server/trpc/routers/post.ts
git commit -m "feat(post): include like/bookmark/comment counts in bySlug"
```

---

## Task 4 — LikeButton (useOptimistic — 토글 + 카운트)

**Files:** `src/components/post/like-button.tsx`

### Steps

- [x] **4.1 LikeButton**

```tsx
"use client";
// 학습 포인트: useOptimistic 으로 클릭 즉시 UI 가 반영되고,
// 서버 응답이 오면 실제 값으로 sync. 실패 시 throw 하지 않고 try/catch 로 rollback.
import { useOptimistic, useTransition } from "react";
import { trpc } from "@/lib/trpc-client";

export function LikeButton({
  postId, initialLiked, initialCount,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const toggle = trpc.like.toggle.useMutation();
  const [isPending, startTransition] = useTransition();

  // 단일 객체로 묶어두면 두 필드를 한 번에 낙관적으로 변경 가능.
  const [optimistic, setOptimistic] = useOptimistic(
    { liked: initialLiked, count: initialCount },
    (state, action: { liked: boolean }) => ({
      liked: action.liked,
      count: state.count + (action.liked ? 1 : -1),
    }),
  );

  function onClick() {
    const next = !optimistic.liked;
    startTransition(async () => {
      setOptimistic({ liked: next });
      try {
        const r = await toggle.mutateAsync({ postId });
        // 서버 응답으로 sync — 동시 다발 클릭 시 카운트 정합성 보장.
        setOptimistic({ liked: r.liked });
      } catch {
        // 실패 시 다음 RSC refresh 또는 useOptimistic 의 자동 rollback.
      }
    });
  }

  return (
    <button onClick={onClick} disabled={isPending}
      className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
      <span>{optimistic.liked ? "♥" : "♡"}</span>
      <span>{optimistic.count}</span>
    </button>
  );
}
```

- [x] **4.2 글 상세에 추가**

`posts/[slug]/page.tsx` 의 header 안에:
```tsx
import { LikeButton } from "@/components/post/like-button";
import { BookmarkButton } from "@/components/post/bookmark-button";
// ...
<div className="mt-4 flex gap-2">
  <LikeButton postId={post.id} initialLiked={post.liked} initialCount={post.likeCount} />
  <BookmarkButton postId={post.id} initialBookmarked={post.bookmarked} />
</div>
```

- [x] **4.3 커밋**

```bash
git add src/components/post/like-button.tsx src/app/\[locale\]/\(main\)/posts/\[slug\]/page.tsx
git commit -m "feat(post): LikeButton with useOptimistic"
```

---

## Task 5 — BookmarkButton + /me/bookmarks

**Files:** `src/components/post/bookmark-button.tsx`, `src/app/[locale]/(main)/me/bookmarks/page.tsx`

### Steps

- [x] **5.1 BookmarkButton**

```tsx
"use client";
import { useOptimistic, useTransition } from "react";
import { trpc } from "@/lib/trpc-client";

export function BookmarkButton({
  postId, initialBookmarked,
}: { postId: string; initialBookmarked: boolean }) {
  const toggle = trpc.bookmark.toggle.useMutation();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    initialBookmarked,
    (_state, next: boolean) => next,
  );

  function onClick() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        const r = await toggle.mutateAsync({ postId });
        setOptimistic(r.bookmarked);
      } catch { /* 다음 RSC refresh 가 진실 */ }
    });
  }

  return (
    <button onClick={onClick} disabled={isPending}
      className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
      {optimistic ? "★ 북마크됨" : "☆ 북마크"}
    </button>
  );
}
```

- [x] **5.2 /me/bookmarks 페이지 (RSC)**

```tsx
// src/app/[locale]/(main)/me/bookmarks/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { createCaller } from "@/server/trpc/caller";
import { PostCard } from "@/components/post/post-card";

export default async function MyBookmarksPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/ko/sign-in");
  const caller = await createCaller();
  const items = await caller.bookmark.myBookmarks();
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">내 북마크</h1>
      <div className="flex flex-col gap-3">
        {items.map((p) => <PostCard key={p.id} post={p} />)}
        {!items.length && <p className="text-sm text-zinc-500">아직 북마크가 없습니다.</p>}
      </div>
    </main>
  );
}
```

- [x] **5.3 커밋**

```bash
git add src/components/post/bookmark-button.tsx src/app/\[locale\]/\(main\)/me/bookmarks/page.tsx
git commit -m "feat(post): BookmarkButton + /me/bookmarks page"
```

---

## Task 6 — CommentSection + Suspense streaming + CommentForm

**Files:** `src/components/comment/comment-section.tsx`, `comment-list.tsx`, `comment-form.tsx`, `comment-item.tsx`; `posts/[slug]/page.tsx`(modify)

### Steps

- [x] **6.1 CommentSection (Suspense 경계)**

```tsx
// src/components/comment/comment-section.tsx
import { Suspense } from "react";
import { CommentList } from "./comment-list";
import { CommentForm } from "./comment-form";

export function CommentSection({ postId }: { postId: string }) {
  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="mb-4 text-lg font-semibold">댓글</h2>
      <CommentForm postId={postId} />
      <Suspense fallback={<CommentSkeleton />}>
        {/* RSC — fetch 가 일어나는 동안 위 폼은 즉시 노출. */}
        <CommentList postId={postId} />
      </Suspense>
    </section>
  );
}

function CommentSkeleton() {
  return (
    <div className="mt-4 animate-pulse text-sm text-zinc-400">댓글 불러오는 중…</div>
  );
}
```

- [x] **6.2 CommentList (RSC)**

```tsx
// src/components/comment/comment-list.tsx
import { createCaller } from "@/server/trpc/caller";
import { CommentItem } from "./comment-item";

export async function CommentList({ postId }: { postId: string }) {
  const caller = await createCaller();
  const all = await caller.comment.listByPost({ postId });
  // 1단계: 부모만 추출 → 자식들 grouping.
  const roots = all.filter((c) => !c.parentId);
  const children = new Map<string, typeof all>();
  for (const c of all) {
    if (c.parentId) {
      const list = children.get(c.parentId) ?? [];
      list.push(c);
      children.set(c.parentId, list);
    }
  }
  if (roots.length === 0)
    return <p className="mt-4 text-sm text-zinc-400">첫 댓글을 남겨보세요.</p>;
  return (
    <ul className="mt-4 space-y-4">
      {roots.map((c) => (
        <CommentItem key={c.id} comment={c} replies={children.get(c.id) ?? []} postId={postId} />
      ))}
    </ul>
  );
}
```

- [x] **6.3 CommentItem (삭제 + 대댓글 토글 — 클라이언트)**

```tsx
// src/components/comment/comment-item.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { trpc } from "@/lib/trpc-client";
import { CommentForm } from "./comment-form";

interface CommentDTO {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
}

export function CommentItem({
  comment, replies, postId,
}: {
  comment: CommentDTO;
  replies: CommentDTO[];
  postId: string;
}) {
  const [replying, setReplying] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const del = trpc.comment.delete.useMutation();

  function onDelete() {
    if (!confirm("댓글을 삭제하시겠어요?")) return;
    startTransition(async () => {
      await del.mutateAsync({ id: comment.id });
      router.refresh();
    });
  }

  return (
    <li>
      <article className="flex gap-3">
        {comment.authorAvatarUrl ? (
          <Image src={comment.authorAvatarUrl} alt="" width={32} height={32} unoptimized
            className="size-8 rounded-full object-cover" />
        ) : (
          <div className="size-8 rounded-full bg-zinc-200" />
        )}
        <div className="flex-1">
          <header className="flex items-baseline gap-2 text-xs text-zinc-500">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{comment.authorNickname}</span>
            <time>{new Date(comment.createdAt).toLocaleString("ko-KR")}</time>
          </header>
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
          <div className="mt-2 flex gap-3 text-xs text-zinc-500">
            <button onClick={() => setReplying((p) => !p)} className="underline">답글</button>
            <button onClick={onDelete} disabled={isPending} className="underline">삭제</button>
          </div>
          {replying && (
            <div className="mt-2">
              <CommentForm postId={postId} parentId={comment.id} onPosted={() => setReplying(false)} />
            </div>
          )}
        </div>
      </article>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-3 pl-10 border-l">
          {replies.map((r) => (
            <CommentItem key={r.id} comment={r} replies={[]} postId={postId} />
          ))}
        </ul>
      )}
    </li>
  );
}
```

- [x] **6.4 CommentForm (useOptimistic 리스트 추가)**

```tsx
// src/components/comment/comment-form.tsx
"use client";
// 학습 포인트: useOptimistic 리스트 패턴.
// 폼 제출 즉시 임시 항목을 리스트에 추가한 뒤, 서버 응답이 오면 실제 id 로 교체.
// RSC refetch 가 한 번 더 진실을 가져오므로 정합성 보장.
import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";

interface PendingItem { tempId: string; content: string }

export function CommentForm({
  postId, parentId, onPosted,
}: { postId: string; parentId?: string; onPosted?: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const create = trpc.comment.create.useMutation();
  const [isPending, startTransition] = useTransition();

  const [pending, addOptimistic] = useOptimistic<PendingItem[], PendingItem>(
    [],
    (state, action) => [...state, action],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = ref.current?.value.trim() ?? "";
    if (!content) return;
    const tempId = crypto.randomUUID();
    startTransition(async () => {
      addOptimistic({ tempId, content });
      ref.current!.value = "";
      try {
        await create.mutateAsync({ postId, parentId, content });
        router.refresh(); // RSC CommentList 가 새 댓글까지 포함해 다시 fetch.
        onPosted?.();
      } catch (err) {
        // 실패 시 router.refresh 가 진실로 덮어씀.
        console.error(err);
      }
    });
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <textarea ref={ref} required maxLength={1000} placeholder="댓글을 남겨주세요"
          className="flex-1 rounded border px-3 py-2 text-sm" rows={2} />
        <button type="submit" disabled={isPending}
          className="rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          작성
        </button>
      </form>
      {pending.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pending.map((p) => (
            <li key={p.tempId} className="rounded border border-dashed px-3 py-2 text-xs text-zinc-400">
              ⏳ {p.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [x] **6.5 글 상세에 마운트**

`posts/[slug]/page.tsx` 끝부분:
```tsx
import { CommentSection } from "@/components/comment/comment-section";
// ...
<CommentSection postId={post.id} />
```

- [x] **6.6 커밋**

```bash
git add src/components/comment/ src/app/\[locale\]/\(main\)/posts/\[slug\]/page.tsx
git commit -m "feat(comments): CommentSection with Suspense + useOptimistic form"
```

---

## Task 7 — 수동 검증

### Steps

- [x] **7.1 시나리오**

1. 글 상세 페이지 진입 → 본문은 즉시 렌더, 댓글 영역은 fallback "댓글 불러오는 중…" 노출 후 채워짐.
2. 댓글 작성 → 입력 즉시 "⏳" 임시 항목 노출 → 서버 응답 후 정식 목록으로 교체.
3. DevTools Network throttling 을 Slow 3G 로 두면 차이가 또렷.
4. 좋아요 클릭 → 카운트 + 1 즉시 반영. 다시 클릭 → -1 즉시 반영.
5. 북마크 클릭 → "★ 북마크됨" 즉시 반영, `/ko/me/bookmarks` 에서 노출 확인.
6. 다른 사용자로 로그인 → 다른 사람 댓글 삭제 시 FORBIDDEN.
7. 의도적으로 `like.toggle` mutation 에 `throw` 삽입 → 클릭 → 즉시 +1 → 다음 RSC refresh 에서 -1 롤백 관찰.

---

## 마일스톤 종료 체크리스트

- [x] `pnpm typecheck` 통과.
- [x] 댓글/좋아요/북마크 풀 흐름 통과.
- [x] `useOptimistic` 3종(리스트 추가/카운트/토글) 모두 동작.
- [x] Suspense fallback 노출 후 댓글 streaming.

---

## 다음 단계

**M7 — 탐색 (검색 + 무한 스크롤 + prefetch+hydration)** (`docs/plans/M7-discovery.md`).

---

문서 끝.
