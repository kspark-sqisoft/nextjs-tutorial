// 글 도메인 라우터.
// 학습 포인트:
//  - list 는 keyset 페이지네이션 (M7 무한 스크롤이 이 cursor 그대로 사용).
//  - create/update 는 한 트랜잭션에 post + tag upsert + post_tags + attachments.post_id 갱신.
//  - 본문 인라인 attachments 의 ownership 을 owner_id 로 검증해, 남의 키를 삽입하는 시도 차단.
import { z } from "zod";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import {
  attachments,
  bookmarks,
  categories,
  comments,
  likes,
  postTags,
  posts,
  tags,
  users,
} from "@/server/db/schema";
import { requestUpload } from "@/server/storage/presign";
import { normalizeS3Url, publicUrl } from "@/server/storage/s3";
import { uniquePostSlug } from "@/server/posts/slug";
import { extractText } from "@/server/posts/extract-text";

const TagInput = z.string().min(1).max(20);

const CreateInput = z.object({
  title: z.string().min(1).max(120),
  contentJson: z.unknown(),
  categorySlug: z.string().nullable(),
  tagSlugs: z.array(TagInput).max(10).default([]),
  isPublished: z.boolean().default(true),
  // 본문 인라인/첨부 업로드 결과의 objectKey 목록 — post 생성 시 attachments.post_id 를 채워준다.
  attachmentKeys: z.array(z.string()).default([]),
});

export const postRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
        cursor: z.string().nullish(), // base64("createdAtIso|id")
        tagSlug: z.string().nullish(),
        categorySlug: z.string().nullish(),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [
        eq(posts.isHidden, false),
        eq(posts.isPublished, true),
      ];
      if (input.categorySlug) {
        const [c] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slug, input.categorySlug))
          .limit(1);
        if (!c) return { items: [], nextCursor: null };
        conditions.push(eq(posts.categoryId, c.id));
      }
      if (input.cursor) {
        const [iso, id] = Buffer.from(input.cursor, "base64")
          .toString("utf8")
          .split("|");
        conditions.push(
          or(
            lt(posts.createdAt, new Date(iso!)),
            and(
              eq(posts.createdAt, new Date(iso!)),
              lt(posts.id, id!),
            )!,
          )!,
        );
      }
      let q = db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          createdAt: posts.createdAt,
          authorId: posts.authorId,
          authorNickname: users.nickname,
          authorAvatarKey: users.avatarKey,
          // 카드용 200자 미리보기 + 카테고리 칩.
          excerpt: sql<string>`substring(${posts.contentText} from 1 for 200)`,
          // 본문 content_json 의 첫 image 노드 src 를 추출 — 그리드 카드 cover.
          // 학습 포인트: jsonb_array_elements 로 배열을 펼친 뒤 type='image' 첫 행의 attrs.src.
          coverImageUrl: sql<
            string | null
          >`(SELECT n->'attrs'->>'src' FROM jsonb_array_elements(${posts.contentJson}->'content') n WHERE n->>'type' = 'image' LIMIT 1)`,
          categorySlug: categories.slug,
          categoryName: categories.name,
        })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .leftJoin(categories, eq(categories.id, posts.categoryId))
        .where(and(...conditions))
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(input.limit + 1)
        .$dynamic();

      if (input.tagSlug) {
        const [t] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(eq(tags.slug, input.tagSlug))
          .limit(1);
        if (!t) return { items: [], nextCursor: null };
        q = q.innerJoin(
          postTags,
          and(eq(postTags.postId, posts.id), eq(postTags.tagId, t.id))!,
        );
      }
      const rows = await q;
      const items = rows.slice(0, input.limit).map((r) => ({
        ...r,
        authorAvatarUrl: r.authorAvatarKey
          ? publicUrl(r.authorAvatarKey)
          : null,
        // 본문 JSON 에서 추출한 cover src 도 현재 S3_PUBLIC_URL 로 정규화.
        coverImageUrl: r.coverImageUrl ? normalizeS3Url(r.coverImageUrl) : null,
      }));
      const next = rows[input.limit];
      const nextCursor = next
        ? Buffer.from(
            `${next.createdAt.toISOString()}|${next.id}`,
          ).toString("base64")
        : null;
      return { items, nextCursor };
    }),

  bySlug: publicProcedure
    .input(
      z.object({
        // 한글 slug 의 NFD/NFC 차이로 DB 매칭이 어긋나는 사고 방지 — NFC 로 정규화.
        slug: z.string().transform((s) => s.normalize("NFC")),
      }),
    )
    .query(async ({ input, ctx }) => {
      const [p] = await db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          contentJson: posts.contentJson,
          isHidden: posts.isHidden,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          authorId: posts.authorId,
          authorNickname: users.nickname,
          authorAvatarKey: users.avatarKey,
          categoryId: posts.categoryId,
          categorySlug: categories.slug,
          categoryName: categories.name,
        })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .leftJoin(categories, eq(categories.id, posts.categoryId))
        .where(eq(posts.slug, input.slug))
        .limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      // 숨김 글은 작성자/관리자만.
      if (
        p.isHidden &&
        (!ctx.user ||
          (ctx.user.id !== p.authorId && ctx.user.role !== "ADMIN"))
      ) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const tagRows = await db
        .select({ slug: tags.slug, name: tags.name })
        .from(postTags)
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .where(eq(postTags.postId, p.id));
      const attaches = await db
        .select({
          id: attachments.id,
          originalName: attachments.originalName,
          objectKey: attachments.objectKey,
          mimeType: attachments.mimeType,
          sizeBytes: attachments.sizeBytes,
          kind: attachments.kind,
        })
        .from(attachments)
        .where(
          and(
            eq(attachments.postId, p.id),
            eq(attachments.kind, "POST_ATTACHMENT"),
          ),
        );
      // 좋아요/댓글 카운트 + 현재 사용자의 liked/bookmarked 상태.
      // 학습 단순화: 분리된 쿼리 3-4개. 운영에선 lateral join 한 번으로 묶을 수 있다.
      const [likeRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(likes)
        .where(eq(likes.postId, p.id));
      const [commentRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(eq(comments.postId, p.id));
      let liked = false;
      let bookmarked = false;
      if (ctx.user) {
        const [l] = await db
          .select()
          .from(likes)
          .where(
            and(eq(likes.userId, ctx.user.id), eq(likes.postId, p.id)),
          )
          .limit(1);
        liked = !!l;
        const [b] = await db
          .select()
          .from(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, ctx.user.id),
              eq(bookmarks.postId, p.id),
            ),
          )
          .limit(1);
        bookmarked = !!b;
      }

      return {
        ...p,
        authorAvatarUrl: p.authorAvatarKey
          ? publicUrl(p.authorAvatarKey)
          : null,
        tags: tagRows,
        attachments: attaches.map((a) => ({
          ...a,
          url: publicUrl(a.objectKey),
        })),
        likeCount: likeRow?.count ?? 0,
        commentCount: commentRow?.count ?? 0,
        liked,
        bookmarked,
      };
    }),

  create: protectedProcedure
    .input(CreateInput)
    .mutation(async ({ ctx, input }) => {
      const slug = await uniquePostSlug(input.title);
      const contentText = extractText(input.contentJson);

      let categoryId: string | null = null;
      if (input.categorySlug) {
        const [c] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slug, input.categorySlug))
          .limit(1);
        categoryId = c?.id ?? null;
      }

      const result = await db.transaction(async (tx) => {
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

        for (const raw of input.tagSlugs) {
          const tslug = raw.toLowerCase().trim();
          if (!tslug) continue;
          const [existing] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(eq(tags.slug, tslug))
            .limit(1);
          const tagId = existing
            ? existing.id
            : (
                await tx
                  .insert(tags)
                  .values({ slug: tslug, name: raw })
                  .returning({ id: tags.id })
              )[0]!.id;
          await tx
            .insert(postTags)
            .values({ postId: created!.id, tagId })
            .onConflictDoNothing();
        }

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

      return { id: result, slug };
    }),

  update: protectedProcedure
    .input(CreateInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await db
        .select({ authorId: posts.authorId, slug: posts.slug })
        .from(posts)
        .where(eq(posts.id, input.id))
        .limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      if (p.authorId !== ctx.user.id && ctx.user.role !== "ADMIN")
        throw new TRPCError({ code: "FORBIDDEN" });

      let categoryId: string | null = null;
      if (input.categorySlug) {
        const [c] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slug, input.categorySlug))
          .limit(1);
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
          const [existing] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(eq(tags.slug, tslug))
            .limit(1);
          const tagId = existing
            ? existing.id
            : (
                await tx
                  .insert(tags)
                  .values({ slug: tslug, name: raw })
                  .returning({ id: tags.id })
              )[0]!.id;
          await tx
            .insert(postTags)
            .values({ postId: input.id, tagId })
            .onConflictDoNothing();
        }

        if (input.attachmentKeys.length) {
          await tx
            .update(attachments)
            .set({ postId: input.id })
            .where(
              and(
                eq(attachments.ownerId, ctx.user.id),
                inArray(attachments.objectKey, input.attachmentKeys),
              ),
            );
        }
      });
      return { id: input.id, slug: p.slug };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await db
        .select({ authorId: posts.authorId })
        .from(posts)
        .where(eq(posts.id, input.id))
        .limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      if (p.authorId !== ctx.user.id && ctx.user.role !== "ADMIN")
        throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(posts).where(eq(posts.id, input.id));
      // TODO: MinIO 객체 자체는 별도 GC 작업 필요 (학습 범위 밖).
      return { ok: true as const };
    }),

  // 본문/첨부 업로드용 presigned URL 발급.
  requestAttachmentUpload: protectedProcedure
    .input(
      z.object({
        kind: z.enum(["POST_INLINE", "POST_ATTACHMENT"]),
        mime: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      return requestUpload(input);
    }),

  // 업로드 완료 후 attachments INSERT. 글 생성 전이라 post_id 는 null.
  confirmAttachment: protectedProcedure
    .input(
      z.object({
        kind: z.enum(["POST_INLINE", "POST_ATTACHMENT"]),
        objectKey: z.string(),
        originalName: z.string(),
        mime: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.insert(attachments).values({
        ownerId: ctx.user.id,
        objectKey: input.objectKey,
        originalName: input.originalName,
        mimeType: input.mime,
        sizeBytes: input.sizeBytes,
        kind: input.kind,
      });
      return {
        url: publicUrl(input.objectKey),
        objectKey: input.objectKey,
      };
    }),

  // 전체 검색 — 제목 + 본문 ILIKE 부분 매칭.
  // 학습 포인트:
  //  - ILIKE 는 대소문자 무시 부분 매칭. 한국어처럼 토크나이저가 약한 언어에 단순/유효.
  //  - 사용자 입력에 %, _ 가 들어가도 안전하도록 escape.
  //  - cursor: base64("createdAtIso|id") — list 와 동일 패턴.
  //  - 카드와 동일 schema (excerpt, coverImageUrl, categoryName) 를 반환해
  //    프론트에서 동일한 PostCard 로 렌더 가능.
  search: publicProcedure
    .input(
      z.object({
        q: z.string().min(1).max(80),
        limit: z.number().int().min(1).max(50).default(10),
        cursor: z.string().nullish(),
      }),
    )
    .query(async ({ input }) => {
      // SQL LIKE 특수문자(%, _, \) escape.
      const escaped = input.q.replace(/[\\%_]/g, (m) => `\\${m}`);
      const pattern = `%${escaped}%`;

      const conditions = [
        eq(posts.isHidden, false),
        eq(posts.isPublished, true),
        // 제목 OR 본문 텍스트에서 부분 매칭.
        or(
          sql`${posts.title} ILIKE ${pattern}`,
          sql`${posts.contentText} ILIKE ${pattern}`,
        )!,
      ];
      if (input.cursor) {
        const [iso, id] = Buffer.from(input.cursor, "base64")
          .toString("utf8")
          .split("|");
        conditions.push(
          or(
            lt(posts.createdAt, new Date(iso!)),
            and(
              eq(posts.createdAt, new Date(iso!)),
              lt(posts.id, id!),
            )!,
          )!,
        );
      }

      const rows = await db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          createdAt: posts.createdAt,
          authorId: posts.authorId,
          authorNickname: users.nickname,
          authorAvatarKey: users.avatarKey,
          excerpt: sql<string>`substring(${posts.contentText} from 1 for 200)`,
          coverImageUrl: sql<
            string | null
          >`(SELECT n->'attrs'->>'src' FROM jsonb_array_elements(${posts.contentJson}->'content') n WHERE n->>'type' = 'image' LIMIT 1)`,
          categorySlug: categories.slug,
          categoryName: categories.name,
        })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .leftJoin(categories, eq(categories.id, posts.categoryId))
        .where(and(...conditions))
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(input.limit + 1);

      const items = rows.slice(0, input.limit).map((r) => ({
        ...r,
        authorAvatarUrl: r.authorAvatarKey
          ? publicUrl(r.authorAvatarKey)
          : null,
        // list 와 동일하게 cover src 호스트 정규화.
        coverImageUrl: r.coverImageUrl ? normalizeS3Url(r.coverImageUrl) : null,
      }));
      const next = rows[input.limit];
      const nextCursor = next
        ? Buffer.from(
            `${next.createdAt.toISOString()}|${next.id}`,
          ).toString("base64")
        : null;
      return { items, nextCursor };
    }),

  listCategories: publicProcedure.query(async () => {
    return db.select().from(categories).orderBy(categories.name);
  }),
});
