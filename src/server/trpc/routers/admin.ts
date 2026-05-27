// 관리자 라우터.
// 학습 포인트:
//  - 모든 procedure 가 adminProcedure 위에 — ctx.user.role === 'ADMIN' 보장.
//  - users.setActive 가 비활성화 시 sessions 일괄 revoke 로 즉시 강제 로그아웃.
//  - posts.setHidden 은 boolean 토글, 공개 라우터(post.list/bySlug) 는 이미 is_hidden=false 필터.
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
});

export const adminRouter = router({
  users: router({
    list: adminProcedure
      .input(
        ListInput.extend({
          role: z.enum(["USER", "ADMIN"]).optional(),
          onlyInactive: z.boolean().default(false),
        }),
      )
      .query(async ({ input }) => {
        const where = [];
        if (input.q) where.push(ilike(users.email, `%${input.q}%`));
        if (input.role) where.push(eq(users.role, input.role));
        if (input.onlyInactive) where.push(eq(users.isActive, false));
        const rows = await db
          .select({
            id: users.id,
            email: users.email,
            nickname: users.nickname,
            role: users.role,
            isActive: users.isActive,
            emailVerifiedAt: users.emailVerifiedAt,
            createdAt: users.createdAt,
            avatarKey: users.avatarKey,
          })
          .from(users)
          .where(where.length ? and(...where) : undefined)
          .orderBy(desc(users.createdAt))
          .limit(input.limit);
        return rows.map((r) => ({
          ...r,
          avatarUrl: r.avatarKey ? publicUrl(r.avatarKey) : null,
        }));
      }),

    setActive: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          isActive: z.boolean(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id && !input.isActive) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "자기 자신을 비활성화 할 수 없습니다.",
          });
        }
        await db
          .update(users)
          .set({ isActive: input.isActive, updatedAt: new Date() })
          .where(eq(users.id, input.userId));
        if (!input.isActive) {
          // 즉시 강제 로그아웃 — 모든 활성 세션 revoke.
          await db
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(sessions.userId, input.userId),
                sql`${sessions.revokedAt} IS NULL`,
              ),
            );
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
            id: posts.id,
            title: posts.title,
            slug: posts.slug,
            isHidden: posts.isHidden,
            isPublished: posts.isPublished,
            createdAt: posts.createdAt,
            authorNickname: users.nickname,
            authorEmail: users.email,
          })
          .from(posts)
          .innerJoin(users, eq(users.id, posts.authorId))
          .where(where.length ? and(...where) : undefined)
          .orderBy(desc(posts.createdAt))
          .limit(input.limit);
        return rows;
      }),

    setHidden: adminProcedure
      .input(
        z.object({
          postId: z.string().uuid(),
          isHidden: z.boolean(),
        }),
      )
      .mutation(async ({ input }) => {
        await db
          .update(posts)
          .set({ isHidden: input.isHidden, updatedAt: new Date() })
          .where(eq(posts.id, input.postId));
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
