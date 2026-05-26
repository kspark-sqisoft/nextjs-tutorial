// 좋아요 토글 — 한 트랜잭션 안에서 SELECT 로 현재 상태 확인 후 INSERT 또는 DELETE.
// 학습 포인트:
//  - INSERT ON CONFLICT DO NOTHING + returning 의 빈 배열을 토글 신호로 쓰면
//    드라이버/ORM 의 returning 거동 차이에 따라 첫 클릭이 OFF 로 잘못 빠질 수 있다.
//  - select-then-act 는 명시적이라 디버깅이 쉽고, 단일 트랜잭션이라 race 노출 면적도 작다.
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { likes } from "@/server/db/schema";

export const likeRouter = router({
  toggle: protectedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ userId: likes.userId })
          .from(likes)
          .where(
            and(
              eq(likes.userId, ctx.user.id),
              eq(likes.postId, input.postId),
            ),
          )
          .limit(1);
        let liked: boolean;
        if (existing) {
          await tx
            .delete(likes)
            .where(
              and(
                eq(likes.userId, ctx.user.id),
                eq(likes.postId, input.postId),
              ),
            );
          liked = false;
        } else {
          await tx
            .insert(likes)
            .values({ userId: ctx.user.id, postId: input.postId });
          liked = true;
        }
        const [row] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(likes)
          .where(eq(likes.postId, input.postId));
        return { liked, count: row?.count ?? 0 };
      });
    }),
});
