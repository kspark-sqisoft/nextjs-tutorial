// 프로필 조회/수정 + 아바타 업로드 presign/confirm.
// 학습 포인트:
//  - presign 은 서버에서만 발급 (S3 키 노출 없음).
//  - confirm 에서 화이트리스트 재검증 — 클라이언트가 우회해도 막힘.
//  - attachments INSERT + users.avatar_key 갱신을 한 트랜잭션으로 처리.
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { attachments, users } from "@/server/db/schema";
import { requestUpload } from "@/server/storage/presign";
import { publicUrl } from "@/server/storage/s3";
import { UPLOAD_CONSTRAINTS } from "@/server/storage/constraints";

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [u] = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        bio: users.bio,
        avatarKey: users.avatarKey,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!u) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      ...u,
      avatarUrl: u.avatarKey ? publicUrl(u.avatarKey) : null,
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        nickname: z.string().min(2).max(20),
        bio: z.string().max(200).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(users)
        .set({
          nickname: input.nickname,
          bio: input.bio,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));
      return { ok: true as const };
    }),

  requestAvatarUpload: protectedProcedure
    .input(
      z.object({
        mime: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      return requestUpload({
        kind: "AVATAR",
        mime: input.mime,
        sizeBytes: input.sizeBytes,
      });
    }),

  confirmAvatar: protectedProcedure
    .input(
      z.object({
        objectKey: z.string().min(1),
        originalName: z.string().min(1).max(255),
        mime: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const c = UPLOAD_CONSTRAINTS.AVATAR;
      if (
        !c.mimeWhitelist.has(input.mime) ||
        input.sizeBytes > c.maxBytes
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "허용되지 않는 파일입니다.",
        });
      }
      // attachments row + users.avatar_key 갱신을 한 트랜잭션으로.
      await db.transaction(async (tx) => {
        await tx.insert(attachments).values({
          ownerId: ctx.user.id,
          objectKey: input.objectKey,
          originalName: input.originalName,
          mimeType: input.mime,
          sizeBytes: input.sizeBytes,
          kind: "AVATAR",
        });
        await tx
          .update(users)
          .set({ avatarKey: input.objectKey, updatedAt: new Date() })
          .where(eq(users.id, ctx.user.id));
      });
      return {
        ok: true as const,
        avatarUrl: publicUrl(input.objectKey),
      };
    }),
});
