"use server";
// 글 삭제 Server Action — 폼 action 으로 호출되므로 revalidatePath/redirect 안전.
// 학습 차원에서 단순 흐름만 보여준다. 본 CRUD 의 메인 경로는 tRPC mutation 이다.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/current-user";

export async function deletePostAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new TRPCError({ code: "UNAUTHORIZED" });
  const id = String(formData.get("id"));
  const [p] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!p) throw new TRPCError({ code: "NOT_FOUND" });
  if (p.authorId !== me.id && me.role !== "ADMIN")
    throw new TRPCError({ code: "FORBIDDEN" });
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePath("/");
  redirect("/");
}
