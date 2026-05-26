"use server";
// 닉네임/소개 수정 Server Action.
// 실제 mutation 은 tRPC `profile.update` 와 본질적으로 같지만,
// 학습 차원에서 폼 제출 = Server Action 패턴을 사용한다.
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/current-user";
import type { ActionState } from "./auth";

const UpdateProfileInput = z.object({
  nickname: z.string().min(2).max(20),
  bio: z.string().max(200).optional(),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsed = UpdateProfileInput.safeParse({
    nickname: formData.get("nickname"),
    bio: formData.get("bio") || undefined,
  });
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]!.message };

  await db
    .update(users)
    .set({
      nickname: parsed.data.nickname,
      bio: parsed.data.bio ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, me.id));

  revalidatePath("/me");
  return { ok: true, message: "저장되었습니다." };
}
