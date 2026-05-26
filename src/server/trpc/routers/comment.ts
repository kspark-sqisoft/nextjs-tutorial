// 댓글 라우터.
// 학습 포인트:
//  - 대댓글은 1단계만 허용 — parent.parent_id != null 이면 BAD_REQUEST.
//  - 작성자/관리자 외 삭제 시 FORBIDDEN.
import { z } from "zod";
import { eq } from "drizzle-orm";
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
          id: comments.id,
          parentId: comments.parentId,
          content: comments.content,
          createdAt: comments.createdAt,
          authorId: comments.authorId,
          authorNickname: users.nickname,
          authorAvatarKey: users.avatarKey,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorId))
        .where(eq(comments.postId, input.postId))
        .orderBy(comments.createdAt);
      return rows.map((r) => ({
        ...r,
        authorAvatarUrl: r.authorAvatarKey
          ? publicUrl(r.authorAvatarKey)
          : null,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        parentId: z.string().uuid().nullish(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.parentId) {
        const [parent] = await db
          .select({
            parentId: comments.parentId,
            postId: comments.postId,
          })
          .from(comments)
          .where(eq(comments.id, input.parentId))
          .limit(1);
        if (!parent || parent.postId !== input.postId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "잘못된 부모 댓글입니다.",
          });
        if (parent.parentId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "대댓글은 1단계까지만 허용됩니다.",
          });
      }
      const [created] = await db
        .insert(comments)
        .values({
          postId: input.postId,
          parentId: input.parentId ?? null,
          authorId: ctx.user.id,
          content: input.content,
        })
        .returning({
          id: comments.id,
          parentId: comments.parentId,
          content: comments.content,
          createdAt: comments.createdAt,
          authorId: comments.authorId,
        });
      return created!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await db
        .select({ authorId: comments.authorId })
        .from(comments)
        .where(eq(comments.id, input.id))
        .limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.authorId !== ctx.user.id && ctx.user.role !== "ADMIN")
        throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(comments).where(eq(comments.id, input.id));
      return { ok: true as const };
    }),
});
