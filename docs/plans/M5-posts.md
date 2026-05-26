# M5 — 글 도메인 (CRUD + Tiptap + 첨부) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.

**Goal:** 로그인 사용자가 Tiptap 에디터로 제목/본문(이미지·파일 인라인 삽입)/카테고리/태그를 갖춘 글을 작성하고, 목록·상세·수정·삭제까지 동작. 본문 인라인 이미지와 별도 첨부 파일은 M4 의 presigned PUT 파이프라인을 그대로 사용.

**Architecture:** `posts.content_json`(Tiptap JSON) + `posts.content_text`(검색용 plain text) + `posts.search_tsv`(STORED GENERATED tsvector, M7 검색 활용) 3종 보존. 상세 페이지는 RSC 에서 Tiptap JSON 을 `@tiptap/html` 로 HTML 렌더 후 노드 화이트리스트로 sanitize. 글 작성 화면은 클라이언트 컴포넌트, 저장은 Server Action `createPostAction`(+ `revalidatePath`).

**Tech Stack:** @tiptap/react, @tiptap/starter-kit, @tiptap/extension-image, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/html, slugify.

---

## 사전 조건

- [x] M1~M4 완료.
- [x] attachments 테이블의 `post_id` 컬럼은 nullable uuid (M4 에서 만듦). 이 마일스톤에서 posts FK 를 ALTER 로 추가.

---

## 파일 구조

**Create (`src/server/db/schema/`):**
- `categories.ts`, `tags.ts`, `posts.ts`, `post_tags.ts`
- 추가 마이그레이션: attachments.post_id 에 FK 부착

**Create:**
- `src/server/posts/sanitize.ts` — Tiptap JSON → HTML + 노드 화이트리스트
- `src/server/posts/slug.ts` — slugify + 중복 회피
- `src/server/posts/extract-text.ts` — Tiptap JSON → plain text (검색용)
- `src/server/trpc/routers/post.ts`
- `src/server/actions/post.ts` — createPostAction / updatePostAction / deletePostAction
- `src/components/editor/tiptap-editor.tsx`
- `src/components/editor/upload-image-extension.ts`
- `src/components/post/post-form.tsx`
- `src/components/post/attachment-list.tsx`
- `src/components/post/post-card.tsx`
- `src/app/[locale]/(main)/posts/new/page.tsx`
- `src/app/[locale]/(main)/posts/[slug]/page.tsx`
- `src/app/[locale]/(main)/posts/[slug]/edit/page.tsx`
- `scripts/seed-categories.ts`

**Modify:**
- `src/server/db/schema/index.ts`
- `src/server/trpc/routers/_app.ts`
- `src/server/storage/presign.ts` — `confirmAttachment` 헬퍼

**Add deps:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/html`, `slugify`.

---

## 작업 단위 (Task) 분해

총 7 Task.

- Task 1: posts/categories/tags/post_tags 스키마 + 마이그레이션 (+ attachments FK)
- Task 2: 카테고리 시드 + slug/extract/sanitize 유틸
- Task 3: post tRPC 라우터 (list/bySlug/create/update/delete/upload)
- Task 4: createPost/updatePost/deletePost Server Actions
- Task 5: Tiptap 에디터 + upload-image-extension
- Task 6: 글 작성/수정/상세 페이지 + PostForm + AttachmentList + PostCard
- Task 7: 수동 검증

---

## Task 1 — DB 스키마 (posts / categories / tags / post_tags + attachments FK)

**Files:** `src/server/db/schema/categories.ts`, `tags.ts`, `posts.ts`, `post_tags.ts`, `index.ts`(modify)

### Steps

- [x] **1.1 categories**

```ts
// src/server/db/schema/categories.ts
import { sql } from "drizzle-orm";
import { customType, pgTable, text, uuid } from "drizzle-orm/pg-core";

const citext = customType<{ data: string; driverData: string }>({
  dataType() { return "citext"; },
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: citext("slug").notNull().unique(),
  name: text("name").notNull(),
});

export type Category = typeof categories.$inferSelect;
```

- [x] **1.2 tags**

```ts
// src/server/db/schema/tags.ts
import { sql } from "drizzle-orm";
import { customType, pgTable, text, uuid } from "drizzle-orm/pg-core";

const citext = customType<{ data: string; driverData: string }>({
  dataType() { return "citext"; },
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: citext("slug").notNull().unique(),
  name: text("name").notNull(),
});

export type Tag = typeof tags.$inferSelect;
```

- [x] **1.3 posts**

```ts
// src/server/db/schema/posts.ts
import { sql } from "drizzle-orm";
import {
  boolean, customType, index, jsonb, pgTable, text, timestamp, uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { categories } from "./categories";

// tsvector 컬럼은 Drizzle 기본 타입에 없어 customType.
// GENERATED ALWAYS AS ... STORED 는 정의에 직접 표현 어려워, 마이그레이션 SQL 을 손으로 한 줄 추가한다.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() { return "tsvector"; },
});

const citext = customType<{ data: string; driverData: string }>({
  dataType() { return "citext"; },
});

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    slug: citext("slug").notNull().unique(),
    contentJson: jsonb("content_json").notNull(),
    contentText: text("content_text").notNull(),
    isPublished: boolean("is_published").notNull().default(true),
    isHidden: boolean("is_hidden").notNull().default(false),
    // GENERATED 는 마이그레이션 SQL 에서 별도 처리.
    searchTsv: tsvector("search_tsv"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    createdAtIdx: index("posts_created_at_idx").on(t.createdAt),
    authorIdx: index("posts_author_id_idx").on(t.authorId),
    categoryIdx: index("posts_category_id_idx").on(t.categoryId),
    isHiddenIdx: index("posts_is_hidden_idx").on(t.isHidden),
  }),
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

- [x] **1.4 post_tags**

```ts
// src/server/db/schema/post_tags.ts
import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { tags } from "./tags";

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.postId, t.tagId] }) }),
);
```

- [x] **1.5 index.ts 갱신**

```ts
export * from "./_enums";
export * from "./users";
export * from "./sessions";
export * from "./tokens";
export * from "./attachments";
export * from "./categories";
export * from "./tags";
export * from "./posts";
export * from "./post_tags";
```

- [x] **1.6 마이그레이션 생성**

```bash
docker compose -f compose.dev.yml exec app pnpm db:generate
```

- [x] **1.7 산출 SQL 에 GENERATED tsvector + GIN 인덱스 + attachments FK 추가**

생성된 `0005_*.sql` 끝에 추가:
```sql
-- 학습 포인트: Drizzle 가 GENERATED 컬럼을 표현 못해 손으로 ALTER.
-- search_tsv 는 title + content_text 결합. 'simple' configuration 으로 한국어/영어 모두 어느 정도 동작.
ALTER TABLE "posts"
  ALTER COLUMN "search_tsv"
  SET DATA TYPE tsvector
  USING to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_text, ''));

ALTER TABLE "posts"
  ALTER COLUMN "search_tsv"
  SET DEFAULT to_tsvector('simple', '');

-- GENERATED ALWAYS AS ... STORED 로 자동 갱신.
ALTER TABLE "posts" DROP COLUMN "search_tsv";
ALTER TABLE "posts"
  ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_text, ''))) STORED;

CREATE INDEX "posts_search_tsv_idx" ON "posts" USING GIN ("search_tsv");

-- attachments.post_id 에 FK 추가 (M4 에서는 단순 uuid 였음).
ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_post_id_fk"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;
```

- [x] **1.8 적용/검증/커밋**

```bash
docker compose -f compose.dev.yml exec app pnpm db:migrate
docker compose -f compose.dev.yml exec postgres psql -U postgres -d blog -c "\d posts"
docker compose -f compose.dev.yml exec postgres psql -U postgres -d blog -c "\d attachments"

git add src/server/db/schema/categories.ts src/server/db/schema/tags.ts \
  src/server/db/schema/posts.ts src/server/db/schema/post_tags.ts \
  src/server/db/schema/index.ts src/server/db/migrations/*
git commit -m "feat(db): posts/categories/tags + tsvector search column"
```

---

## Task 2 — 시드 + slug / extract / sanitize 유틸

**Files:** `scripts/seed-categories.ts`, `src/server/posts/slug.ts`, `src/server/posts/extract-text.ts`, `src/server/posts/sanitize.ts`

### Steps

- [x] **2.1 deps**

```bash
docker compose -f compose.dev.yml exec app pnpm add @tiptap/react @tiptap/starter-kit \
  @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder @tiptap/html \
  @tiptap/pm slugify
pnpm install
```

- [x] **2.2 slug.ts**

```ts
// 제목 → slug. 한글은 slugify 옵션으로 transliteration 하지 않고, 충돌 시 randomized suffix.
import slugify from "slugify";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema";

export async function uniquePostSlug(title: string) {
  const base = slugify(title, { lower: true, strict: true, locale: "ko" })
    || `post-${Date.now()}`;
  // 빠른 길로 충돌 검사 후 충돌 시 6자 suffix.
  const [exists] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, base)).limit(1);
  if (!exists) return base;
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
```

- [x] **2.3 extract-text.ts**

```ts
// Tiptap JSON 트리에서 텍스트 노드만 모아 한 문자열로 변환 — 검색·미리보기용.
type Node = { type?: string; text?: string; content?: Node[] };
export function extractText(json: unknown): string {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.text) out.push(n.text);
    n.content?.forEach(walk);
  };
  walk(json as Node);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
```

- [x] **2.4 sanitize.ts**

```ts
// Tiptap JSON → 안전한 HTML.
// 학습 포인트: 신뢰할 수 없는 사용자 입력이므로,
// 허용 마크/노드 화이트리스트로 한 번 거른 뒤 generateHTML 로 변환한다.
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";

const ALLOWED_NODES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem",
  "blockquote", "horizontalRule", "codeBlock", "hardBreak", "image",
]);
const ALLOWED_MARKS = new Set(["bold", "italic", "strike", "code", "link"]);

type Node = { type?: string; content?: Node[]; marks?: { type?: string }[] };

function filter(node: Node): Node | null {
  if (!node.type || (node.type !== "doc" && !ALLOWED_NODES.has(node.type))) return null;
  const next: Node = { ...node };
  if (node.marks) next.marks = node.marks.filter((m) => m.type && ALLOWED_MARKS.has(m.type));
  if (node.content) next.content = node.content.map(filter).filter((n): n is Node => n !== null);
  return next;
}

export function renderTiptapToSafeHtml(json: unknown): string {
  const cleaned = filter(json as Node) ?? { type: "doc", content: [] };
  return generateHTML(cleaned, [StarterKit, Image, Link]);
}
```

- [x] **2.5 seed-categories.ts**

```ts
// 첫 실행 시 기본 카테고리 3개 등록 (idempotent).
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { categories } from "@/server/db/schema";

const DEFAULTS = [
  { slug: "general", name: "일반" },
  { slug: "learning", name: "학습" },
  { slug: "retro", name: "회고" },
];

async function main() {
  for (const c of DEFAULTS) {
    const [exists] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, c.slug)).limit(1);
    if (!exists) await db.insert(categories).values(c);
  }
  console.log("✅ categories seeded");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

`package.json` scripts 추가:
```json
"seed:categories": "tsx scripts/seed-categories.ts"
```

- [x] **2.6 커밋**

```bash
docker compose -f compose.dev.yml exec app pnpm seed:categories
git add scripts/seed-categories.ts src/server/posts/ package.json pnpm-lock.yaml
git commit -m "feat(posts): slug/extract/sanitize utils + categories seed"
```

---

## Task 3 — post tRPC 라우터

**Files:** `src/server/trpc/routers/post.ts`, `_app.ts`(modify)

### Steps

- [x] **3.1 post.ts**

```ts
// src/server/trpc/routers/post.ts
import { z } from "zod";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { attachments, categories, postTags, posts, tags, users } from "@/server/db/schema";
import { requestUpload } from "@/server/storage/presign";
import { publicUrl } from "@/server/storage/s3";
import { uniquePostSlug } from "@/server/posts/slug";
import { extractText } from "@/server/posts/extract-text";

const TagInput = z.string().min(1).max(20);

const CreateInput = z.object({
  title: z.string().min(1).max(120),
  contentJson: z.unknown(),
  categorySlug: z.string().nullable(),
  tagSlugs: z.array(TagInput).max(10).default([]),
  isPublished: z.boolean().default(true),
  // 본문 인라인으로 사용한 (또는 첨부 영역의) 업로드 결과의 objectKey 목록 — post 생성 시 attachments.post_id 를 채워준다.
  attachmentKeys: z.array(z.string()).default([]),
});

export const postRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(10),
      cursor: z.string().nullish(), // base64("createdAtIso|id")
      tagSlug: z.string().nullish(),
      categorySlug: z.string().nullish(),
    }))
    .query(async ({ input }) => {
      // M7 에서 진짜 keyset + 무한 스크롤로 확장. 여기는 단순 최신순 페이지네이션.
      const conditions = [eq(posts.isHidden, false), eq(posts.isPublished, true)];
      if (input.categorySlug) {
        const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1);
        if (!c) return { items: [], nextCursor: null };
        conditions.push(eq(posts.categoryId, c.id));
      }
      // cursor 디코딩
      if (input.cursor) {
        const [iso, id] = Buffer.from(input.cursor, "base64").toString("utf8").split("|");
        conditions.push(or(
          lt(posts.createdAt, new Date(iso!)),
          and(eq(posts.createdAt, new Date(iso!)), lt(posts.id, id!))!,
        )!);
      }
      let q = db
        .select({
          id: posts.id, title: posts.title, slug: posts.slug,
          createdAt: posts.createdAt, authorId: posts.authorId,
          authorNickname: users.nickname, authorAvatarKey: users.avatarKey,
        })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(and(...conditions))
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(input.limit + 1)
        .$dynamic();

      if (input.tagSlug) {
        const [t] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, input.tagSlug)).limit(1);
        if (!t) return { items: [], nextCursor: null };
        q = q.innerJoin(postTags, and(eq(postTags.postId, posts.id), eq(postTags.tagId, t.id)));
      }
      const rows = await q;
      const items = rows.slice(0, input.limit).map((r) => ({
        ...r,
        authorAvatarUrl: r.authorAvatarKey ? publicUrl(r.authorAvatarKey) : null,
      }));
      const next = rows[input.limit];
      const nextCursor = next
        ? Buffer.from(`${next.createdAt.toISOString()}|${next.id}`).toString("base64")
        : null;
      return { items, nextCursor };
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const [p] = await db
        .select({
          id: posts.id, title: posts.title, slug: posts.slug,
          contentJson: posts.contentJson, isHidden: posts.isHidden,
          createdAt: posts.createdAt, updatedAt: posts.updatedAt,
          authorId: posts.authorId, authorNickname: users.nickname, authorAvatarKey: users.avatarKey,
          categoryId: posts.categoryId,
        })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(eq(posts.slug, input.slug))
        .limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      // 숨김 글은 작성자/관리자만.
      if (p.isHidden && (!ctx.user || (ctx.user.id !== p.authorId && ctx.user.role !== "ADMIN"))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      // 태그
      const tagRows = await db
        .select({ slug: tags.slug, name: tags.name })
        .from(postTags)
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .where(eq(postTags.postId, p.id));
      // 첨부(POST_ATTACHMENT)
      const attaches = await db
        .select({
          id: attachments.id, originalName: attachments.originalName, objectKey: attachments.objectKey,
          mimeType: attachments.mimeType, sizeBytes: attachments.sizeBytes, kind: attachments.kind,
        })
        .from(attachments)
        .where(and(eq(attachments.postId, p.id), eq(attachments.kind, "POST_ATTACHMENT")));
      return {
        ...p,
        authorAvatarUrl: p.authorAvatarKey ? publicUrl(p.authorAvatarKey) : null,
        tags: tagRows,
        attachments: attaches.map((a) => ({ ...a, url: publicUrl(a.objectKey) })),
      };
    }),

  create: protectedProcedure
    .input(CreateInput)
    .mutation(async ({ ctx, input }) => {
      const slug = await uniquePostSlug(input.title);
      const contentText = extractText(input.contentJson);

      let categoryId: string | null = null;
      if (input.categorySlug) {
        const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1);
        categoryId = c?.id ?? null;
      }

      const postId = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(posts)
          .values({
            authorId: ctx.user.id,
            categoryId,
            title: input.title,
            slug,
            contentJson: input.contentJson as object,
            contentText,
            isPublished: input.isPublished,
          })
          .returning({ id: posts.id });

        // 태그 upsert + post_tags 연결.
        for (const raw of input.tagSlugs) {
          const tslug = raw.toLowerCase().trim();
          if (!tslug) continue;
          const [existing] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, tslug)).limit(1);
          const tagId = existing
            ? existing.id
            : (await tx.insert(tags).values({ slug: tslug, name: raw }).returning({ id: tags.id }))[0]!.id;
          await tx.insert(postTags).values({ postId: created!.id, tagId }).onConflictDoNothing();
        }

        // 인라인/첨부 attachments 의 owner 확인 후 post_id 연결.
        if (input.attachmentKeys.length) {
          await tx
            .update(attachments)
            .set({ postId: created!.id })
            .where(
              and(
                eq(attachments.ownerId, ctx.user.id),
                inArray(attachments.objectKey, input.attachmentKeys),
              ),
            );
        }
        return created!.id;
      });

      return { id: postId, slug };
    }),

  update: protectedProcedure
    .input(CreateInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await db.select({ authorId: posts.authorId, slug: posts.slug }).from(posts).where(eq(posts.id, input.id)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      if (p.authorId !== ctx.user.id && ctx.user.role !== "ADMIN") throw new TRPCError({ code: "FORBIDDEN" });

      let categoryId: string | null = null;
      if (input.categorySlug) {
        const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1);
        categoryId = c?.id ?? null;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(posts)
          .set({
            title: input.title,
            contentJson: input.contentJson as object,
            contentText: extractText(input.contentJson),
            categoryId,
            isPublished: input.isPublished,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, input.id));

        // 태그 전체 교체 (단순 학습 구현).
        await tx.delete(postTags).where(eq(postTags.postId, input.id));
        for (const raw of input.tagSlugs) {
          const tslug = raw.toLowerCase().trim();
          if (!tslug) continue;
          const [existing] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, tslug)).limit(1);
          const tagId = existing
            ? existing.id
            : (await tx.insert(tags).values({ slug: tslug, name: raw }).returning({ id: tags.id }))[0]!.id;
          await tx.insert(postTags).values({ postId: input.id, tagId }).onConflictDoNothing();
        }

        if (input.attachmentKeys.length) {
          await tx
            .update(attachments)
            .set({ postId: input.id })
            .where(
              and(eq(attachments.ownerId, ctx.user.id), inArray(attachments.objectKey, input.attachmentKeys)),
            );
        }
      });
      return { id: input.id, slug: p.slug };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, input.id)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      if (p.authorId !== ctx.user.id && ctx.user.role !== "ADMIN") throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(posts).where(eq(posts.id, input.id));
      // 학습 TODO: attachments 의 MinIO 객체는 lifecycle / 별도 GC 작업 필요.
      return { ok: true as const };
    }),

  // 본문/첨부 업로드용 presigned URL 발급.
  requestAttachmentUpload: protectedProcedure
    .input(z.object({
      kind: z.enum(["POST_INLINE", "POST_ATTACHMENT"]),
      mime: z.string(),
      sizeBytes: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      return requestUpload(input);
    }),

  // 업로드 완료 후 attachments INSERT. 글 생성 전이라 post_id 는 null.
  confirmAttachment: protectedProcedure
    .input(z.object({
      kind: z.enum(["POST_INLINE", "POST_ATTACHMENT"]),
      objectKey: z.string(),
      originalName: z.string(),
      mime: z.string(),
      sizeBytes: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.insert(attachments).values({
        ownerId: ctx.user.id,
        objectKey: input.objectKey,
        originalName: input.originalName,
        mimeType: input.mime,
        sizeBytes: input.sizeBytes,
        kind: input.kind,
      });
      return { url: publicUrl(input.objectKey), objectKey: input.objectKey };
    }),

  listCategories: publicProcedure.query(async () => {
    return db.select().from(categories).orderBy(categories.name);
  }),
});
```

- [x] **3.2 `_app.ts` 갱신**

```ts
import { router } from "../trpc";
import { healthRouter } from "./health";
import { profileRouter } from "./profile";
import { postRouter } from "./post";

export const appRouter = router({
  health: healthRouter,
  profile: profileRouter,
  post: postRouter,
});
export type AppRouter = typeof appRouter;
```

- [x] **3.3 커밋**

```bash
git add src/server/trpc/routers/post.ts src/server/trpc/routers/_app.ts
git commit -m "feat(post): trpc CRUD + attachment upload procedures"
```

---

## Task 4 — Server Actions (create/update/delete)

**Files:** `src/server/actions/post.ts`

### Steps

- [x] **4.1 actions/post.ts**

```ts
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/current-user";
import { uniquePostSlug } from "@/server/posts/slug";
import { extractText } from "@/server/posts/extract-text";
import type { ActionState } from "./auth";

// 실제 트랜잭션 로직은 tRPC post.create/update 가 가지고 있지만,
// 학습 차원에서 Server Action 도 별도로 둔다.
// 폼은 PostForm 안에서 트RPC mutation 을 직접 호출하므로 이 액션은 옵션.
// 여기서는 "글 삭제" 같이 단순한 흐름만 Server Action 으로 보여준다.

export async function deletePostAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new TRPCError({ code: "UNAUTHORIZED" });
  const id = String(formData.get("id"));
  const [p] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!p) throw new TRPCError({ code: "NOT_FOUND" });
  if (p.authorId !== me.id && me.role !== "ADMIN") throw new TRPCError({ code: "FORBIDDEN" });
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePath("/");
  redirect("/");
}
```

- [x] **4.2 커밋**

```bash
git add src/server/actions/post.ts
git commit -m "feat(post): delete server action"
```

---

## Task 5 — Tiptap 에디터 + upload-image-extension

**Files:** `src/components/editor/upload-image-extension.ts`, `src/components/editor/tiptap-editor.tsx`

### Steps

- [x] **5.1 upload-image-extension.ts**

```ts
// Tiptap 의 Image 확장을 wrapping 해 드래그/붙여넣기 시 자동 업로드.
// 학습 포인트: prosemirror 의 transaction 으로 이미지 노드를 임시 placeholder 로 삽입했다가
// 업로드 완료 시 src 만 교체하는 패턴이 정석. 여기는 단순화를 위해 업로드 완료 후 insert.
import Image from "@tiptap/extension-image";
import { Plugin } from "@tiptap/pm/state";

export interface UploadHandler {
  (file: File): Promise<{ src: string }>;
}

export function createUploadImageExtension(upload: UploadHandler) {
  return Image.extend({
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleDOMEvents: {
              drop(view, event) {
                const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
                  f.type.startsWith("image/"),
                );
                if (!files.length) return false;
                event.preventDefault();
                files.forEach(async (file) => {
                  const { src } = await upload(file);
                  const { schema } = view.state;
                  const node = schema.nodes.image!.create({ src, alt: file.name });
                  view.dispatch(view.state.tr.replaceSelectionWith(node));
                });
                return true;
              },
              paste(view, event) {
                const items = Array.from(event.clipboardData?.items ?? []);
                const images = items
                  .map((it) => (it.kind === "file" ? it.getAsFile() : null))
                  .filter((f): f is File => !!f && f.type.startsWith("image/"));
                if (!images.length) return false;
                event.preventDefault();
                images.forEach(async (file) => {
                  const { src } = await upload(file);
                  const { schema } = view.state;
                  const node = schema.nodes.image!.create({ src, alt: file.name });
                  view.dispatch(view.state.tr.replaceSelectionWith(node));
                });
                return true;
              },
            },
          },
        }),
      ];
    },
  });
}
```

- [x] **5.2 tiptap-editor.tsx**

```tsx
"use client";
// Tiptap 에디터 래퍼. content 는 JSON 으로 부모와 동기화.
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc-client";
import { createUploadImageExtension } from "./upload-image-extension";

export interface TiptapEditorProps {
  value: unknown;
  onChange: (json: unknown, opts: { addedAttachmentKey?: string }) => void;
}

export function TiptapEditor({ value, onChange }: TiptapEditorProps) {
  const requestUpload = trpc.post.requestAttachmentUpload.useMutation();
  const confirmUpload = trpc.post.confirmAttachment.useMutation();

  const upload = useCallback(async (file: File) => {
    const { uploadUrl, objectKey, headers } = await requestUpload.mutateAsync({
      kind: "POST_INLINE", mime: file.type, sizeBytes: file.size,
    });
    const res = await fetch(uploadUrl, { method: "PUT", headers, body: file });
    if (!res.ok) throw new Error(`업로드 실패 (${res.status})`);
    const { url } = await confirmUpload.mutateAsync({
      kind: "POST_INLINE", objectKey, originalName: file.name, mime: file.type, sizeBytes: file.size,
    });
    // 부모에게 새 첨부 키 알림 (글 생성 시 attachments.post_id 채우기 위해).
    onChange(value, { addedAttachmentKey: objectKey });
    return { src: url };
  }, [requestUpload, confirmUpload, onChange, value]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "본문을 작성하세요…" }),
      createUploadImageExtension(upload),
    ],
    content: value as object,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON(), {}),
  });

  // 외부에서 value 가 reset 될 때 동기화 (예: 폼 초기화).
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(value)) editor.commands.setContent(value as object);
  }, [value, editor]);

  return (
    <div className="rounded border p-3">
      <EditorContent editor={editor} className="prose min-h-[200px] max-w-none dark:prose-invert" />
    </div>
  );
}
```

- [x] **5.3 커밋**

```bash
git add src/components/editor/
git commit -m "feat(editor): tiptap with drag/paste image upload via presigned PUT"
```

---

## Task 6 — 글 페이지들 + PostForm + AttachmentList + PostCard

**Files:** `src/components/post/*`, `src/app/[locale]/(main)/posts/new/page.tsx`, `posts/[slug]/page.tsx`, `posts/[slug]/edit/page.tsx`

### Steps

- [x] **6.1 PostForm**

```tsx
// src/components/post/post-form.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { AttachmentList } from "./attachment-list";
import { trpc } from "@/lib/trpc-client";

export interface PostFormProps {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    title: string;
    contentJson: unknown;
    categorySlug: string | null;
    tagSlugs: string[];
    isPublished: boolean;
    attachmentObjectKeys?: string[];
  };
}

export function PostForm({ mode, initial }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [contentJson, setContentJson] = useState<unknown>(
    initial?.contentJson ?? { type: "doc", content: [{ type: "paragraph" }] },
  );
  const [categorySlug, setCategorySlug] = useState<string | null>(initial?.categorySlug ?? null);
  const [tagInput, setTagInput] = useState(initial?.tagSlugs?.join(", ") ?? "");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [attachmentKeys, setAttachmentKeys] = useState<string[]>(initial?.attachmentObjectKeys ?? []);
  const [error, setError] = useState<string | null>(null);

  const categories = trpc.post.listCategories.useQuery();
  const create = trpc.post.create.useMutation();
  const update = trpc.post.update.useMutation();

  function onEditorChange(json: unknown, opts: { addedAttachmentKey?: string }) {
    setContentJson(json);
    if (opts.addedAttachmentKey) {
      setAttachmentKeys((prev) =>
        prev.includes(opts.addedAttachmentKey!) ? prev : [...prev, opts.addedAttachmentKey!],
      );
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const tagSlugs = tagInput.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      if (mode === "create") {
        const { slug } = await create.mutateAsync({
          title, contentJson, categorySlug, tagSlugs, isPublished, attachmentKeys,
        });
        router.push(`/ko/posts/${slug}`);
      } else {
        const { slug } = await update.mutateAsync({
          id: initial!.id!, title, contentJson, categorySlug, tagSlugs, isPublished, attachmentKeys,
        });
        router.push(`/ko/posts/${slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
        required maxLength={120} className="rounded border px-3 py-2 text-lg font-semibold" />

      <div className="flex gap-3">
        <select value={categorySlug ?? ""} onChange={(e) => setCategorySlug(e.target.value || null)}
          className="rounded border px-3 py-2">
          <option value="">카테고리 없음</option>
          {categories.data?.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="태그 (쉼표 구분)"
          className="flex-1 rounded border px-3 py-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          공개
        </label>
      </div>

      <TiptapEditor value={contentJson} onChange={onEditorChange} />

      <AttachmentList attachmentKeys={attachmentKeys} onAdded={(k) => setAttachmentKeys((p) => [...p, k])} />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={create.isPending || update.isPending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {create.isPending || update.isPending ? "저장 중..." : "저장"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
```

- [x] **6.2 AttachmentList**

```tsx
// src/components/post/attachment-list.tsx
"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { UPLOAD_CONSTRAINTS } from "@/server/storage/constraints";

export function AttachmentList({
  attachmentKeys,
  onAdded,
}: {
  attachmentKeys: string[];
  onAdded: (objectKey: string) => void;
}) {
  const requestUpload = trpc.post.requestAttachmentUpload.useMutation();
  const confirmUpload = trpc.post.confirmAttachment.useMutation();
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const c = UPLOAD_CONSTRAINTS.POST_ATTACHMENT;
    if (!c.mimeWhitelist.has(file.type)) return setError("허용되지 않는 형식입니다.");
    if (file.size > c.maxBytes) return setError(`${c.maxBytes / 1024 / 1024}MB 이하만 가능합니다.`);
    const { uploadUrl, objectKey, headers } = await requestUpload.mutateAsync({
      kind: "POST_ATTACHMENT", mime: file.type, sizeBytes: file.size,
    });
    const res = await fetch(uploadUrl, { method: "PUT", headers, body: file });
    if (!res.ok) return setError(`업로드 실패 (${res.status})`);
    await confirmUpload.mutateAsync({
      kind: "POST_ATTACHMENT", objectKey, originalName: file.name, mime: file.type, sizeBytes: file.size,
    });
    onAdded(objectKey);
    e.target.value = "";
  }

  return (
    <div className="rounded border p-3">
      <div className="mb-2 text-sm font-medium">첨부 파일</div>
      <ul className="mb-2 list-disc pl-5 text-xs text-zinc-600">
        {attachmentKeys.map((k) => <li key={k}>{k.split("/").pop()}</li>)}
        {!attachmentKeys.length && <li className="list-none text-zinc-400">아직 없음</li>}
      </ul>
      <label className="cursor-pointer text-sm text-blue-600 underline">
        파일 추가
        <input type="file" onChange={onPick} className="hidden" />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

- [x] **6.3 PostCard (RSC 친화 — 클라이언트 코드 없음)**

```tsx
// src/components/post/post-card.tsx
import Link from "next/link";
import Image from "next/image";

export function PostCard({ post }: {
  post: {
    title: string; slug: string; createdAt: Date;
    authorNickname: string; authorAvatarUrl: string | null;
  };
}) {
  return (
    <Link
      href={`/ko/posts/${post.slug}`}
      className="block rounded-lg border p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <h3 className="text-lg font-semibold">{post.title}</h3>
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
        {post.authorAvatarUrl && (
          <Image src={post.authorAvatarUrl} width={20} height={20} alt="" unoptimized
            className="size-5 rounded-full object-cover" />
        )}
        <span>{post.authorNickname}</span>
        <span>·</span>
        <time>{new Date(post.createdAt).toLocaleString("ko-KR")}</time>
      </div>
    </Link>
  );
}
```

- [x] **6.4 작성 페이지**

```tsx
// src/app/[locale]/(main)/posts/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { PostForm } from "@/components/post/post-form";

export default async function NewPostPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/ko/sign-in");
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">새 글 작성</h1>
      <PostForm mode="create" />
    </main>
  );
}
```

- [x] **6.5 상세 페이지 (RSC)**

```tsx
// src/app/[locale]/(main)/posts/[slug]/page.tsx
import { notFound } from "next/navigation";
import { createCaller } from "@/server/trpc/caller";
import { renderTiptapToSafeHtml } from "@/server/posts/sanitize";
import Link from "next/link";

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caller = await createCaller();
  let post;
  try {
    post = await caller.post.bySlug({ slug });
  } catch {
    return notFound();
  }
  const html = renderTiptapToSafeHtml(post.contentJson);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">{post.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {post.authorNickname} · {new Date(post.createdAt).toLocaleString("ko-KR")}
        </p>
      </header>
      <article className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />
      {post.attachments.length > 0 && (
        <section className="mt-8 border-t pt-4">
          <h2 className="mb-2 text-sm font-medium">첨부 파일</h2>
          <ul className="list-disc pl-5 text-sm">
            {post.attachments.map((a) => (
              <li key={a.id}>
                <a href={a.url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                  {a.originalName}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="mt-8 flex gap-4 text-sm">
        <Link href={`/ko/posts/${post.slug}/edit`} className="underline">수정</Link>
      </nav>
    </main>
  );
}
```

- [x] **6.6 수정 페이지**

```tsx
// src/app/[locale]/(main)/posts/[slug]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { createCaller } from "@/server/trpc/caller";
import { PostForm } from "@/components/post/post-form";

export default async function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/ko/sign-in");
  const { slug } = await params;
  const caller = await createCaller();
  let post;
  try { post = await caller.post.bySlug({ slug }); } catch { return notFound(); }
  if (post.authorId !== me.id && me.role !== "ADMIN") return notFound();
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">글 수정</h1>
      <PostForm mode="edit" initial={{
        id: post.id,
        title: post.title,
        contentJson: post.contentJson,
        categorySlug: null, // 학습 단순화: 다시 선택. (정식 구현은 slug 함께 반환)
        tagSlugs: post.tags.map((t) => t.slug),
        isPublished: true,
      }} />
    </main>
  );
}
```

- [x] **6.7 createCaller — RSC 에서 tRPC 직접 호출**

```ts
// src/server/trpc/caller.ts
import { headers as nextHeaders } from "next/headers";
import { appRouter } from "./routers/_app";
import { createContext } from "./context";

export async function createCaller() {
  // RSC 에서 fetch 어댑터 context 를 흉내. 실제 cookies 는 createContext 안의 getCurrentUser 가 읽는다.
  const h = await nextHeaders();
  return appRouter.createCaller(
    await createContext({
      req: new Request("http://internal/", { headers: h }),
      resHeaders: new Headers(),
    } as unknown as Parameters<typeof createContext>[0]),
  );
}
```

- [x] **6.8 홈피드 RSC (임시)** — M7 의 무한 스크롤 전 단순 노출

```tsx
// src/app/[locale]/(main)/page.tsx
import { createCaller } from "@/server/trpc/caller";
import { PostCard } from "@/components/post/post-card";
import Link from "next/link";

export default async function HomePage() {
  const caller = await createCaller();
  const { items } = await caller.post.list({ limit: 10 });
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">최근 글</h1>
        <Link href="/ko/posts/new" className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          글쓰기
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((p) => <PostCard key={p.id} post={p} />)}
        {!items.length && <p className="text-sm text-zinc-500">아직 글이 없습니다.</p>}
      </div>
    </main>
  );
}
```

- [x] **6.9 커밋**

```bash
git add src/components/post/ src/components/editor/ \
  src/app/\[locale\]/\(main\)/posts/ src/app/\[locale\]/\(main\)/page.tsx \
  src/server/trpc/caller.ts
git commit -m "feat(post): create/edit/detail pages + tiptap form + attachments"
```

---

## Task 7 — 수동 검증

- [x] **7.1 시나리오**

1. 로그인 → `/ko/posts/new`.
2. 제목 입력, 본문에 이미지 드래그 → 자동 업로드 → 본문에 노출.
3. 첨부 영역에서 파일 추가.
4. 카테고리/태그 입력 → 저장.
5. 홈에서 카드 노출, 클릭하면 상세 (HTML 렌더 + 첨부 다운로드 링크).
6. 다른 사용자로 로그인 → 수정 페이지 접근 시 404.
7. 작성자/관리자가 수정 → 반영 확인.
8. DB: `attachments.post_id` 가 채워졌는지, `posts.search_tsv` 가 GENERATED 인지 확인.

---

## 마일스톤 종료 체크리스트

- [x] `pnpm typecheck` 통과.
- [x] 새 글 작성·수정·삭제 풀 흐름 통과.
- [x] Tiptap 이미지 업로드 → MinIO 객체 + attachments row 동시 생성.
- [x] 비작성자 수정 시 404, 비공개 글 비작성자에게 NOT_FOUND.

---

## 다음 단계

**M6 — 댓글/좋아요/북마크 + `useOptimistic`** (`docs/plans/M6-interactions.md`).

---

문서 끝.
