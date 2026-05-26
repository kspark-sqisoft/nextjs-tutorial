// RSC / Server Action 에서 사용할 현재 user 조회 도우미.
// 학습 포인트: React 의 cache() 로 같은 요청 안에서는 단 한 번만 DB 조회.
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { readAccessCookie } from "./cookies";
import { verifyAccess } from "./jwt";

export const getCurrentUser = cache(async () => {
  const token = await readAccessCookie();
  if (!token) return null;
  try {
    const p = await verifyAccess(token);
    const [u] = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        bio: users.bio,
        role: users.role,
        avatarKey: users.avatarKey,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, p.sub))
      .limit(1);
    if (!u || !u.isActive) return null;
    return u;
  } catch {
    return null;
  }
});
