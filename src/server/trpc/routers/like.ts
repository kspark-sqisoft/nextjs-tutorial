// 좋아요 토글 — INSERT ON CONFLICT DO NOTHING + 빈 결과면 DELETE.
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { likes } from "@/server/db/schema";

export const likeRouter = router({
  toggle: protectedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .insert(likes)
        .values({ userId: ctx.user.id, postId: input.postId })
        .onConflictDoNothing()
        .returning({ userId: likes.userId });
      let liked: boolean;
      if (result.length === 0) {
        // 이미 존재 → 토글 OFF.
        await db
          .delete(likes)
          .where(
            and(
              eq(likes.userId, ctx.user.id),
              eq(likes.postId, input.postId),
            ),
          );
        liked = false;
      } else {
        liked = true;
      }
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(likes)
        .where(eq(likes.postId, input.postId));
      return { liked, count: row?.count ?? 0 };
    }),
});
