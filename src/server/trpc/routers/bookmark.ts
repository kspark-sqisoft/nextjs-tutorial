// 북마크 토글 + 내 북마크 목록.
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
      // like 와 같은 select-then-act 패턴 (returning 거동 의존 제거).
      return await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ userId: bookmarks.userId })
          .from(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, ctx.user.id),
              eq(bookmarks.postId, input.postId),
            ),
          )
          .limit(1);
        if (existing) {
          await tx
            .delete(bookmarks)
            .where(
              and(
                eq(bookmarks.userId, ctx.user.id),
                eq(bookmarks.postId, input.postId),
              ),
            );
          return { bookmarked: false as const };
        }
        await tx
          .insert(bookmarks)
          .values({ userId: ctx.user.id, postId: input.postId });
        return { bookmarked: true as const };
      });
    }),

  myBookmarks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        createdAt: posts.createdAt,
        authorNickname: users.nickname,
        authorAvatarKey: users.avatarKey,
      })
      .from(bookmarks)
      .innerJoin(posts, eq(posts.id, bookmarks.postId))
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(eq(bookmarks.userId, ctx.user.id))
      .orderBy(desc(bookmarks.createdAt));
    return rows.map((r) => ({
      ...r,
      authorAvatarUrl: r.authorAvatarKey
        ? publicUrl(r.authorAvatarKey)
        : null,
    }));
  }),
});
