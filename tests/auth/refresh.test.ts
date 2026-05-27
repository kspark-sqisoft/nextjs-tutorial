// refresh 토큰 회전 통합 테스트.
// 학습 포인트:
//  - 정상 회전: 새 sessionId + 기존 row revoked_at/replaced_by 설정.
//  - 재사용 공격: 이미 revoke 된 토큰을 다시 쓰면 사용자의 모든 세션 revoke + 에러.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { createSession, rotateSession } from "@/server/auth/session";

async function truncate() {
  await db.execute(sql`
    TRUNCATE TABLE
      sessions, email_verifications, password_resets, users
    RESTART IDENTITY CASCADE
  `);
}

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: "r@x.com", passwordHash: "x", nickname: "r" })
    .returning({ id: users.id, role: users.role });
  return u!;
}

describe("refresh rotation", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("정상 회전 → 새 sessionId 발급, 기존 세션 revoked", async () => {
    const u = await seedUser();
    const a = await createSession({ userId: u.id, role: u.role });
    const b = await rotateSession(a.refresh);
    expect(b.sessionId).not.toBe(a.sessionId);

    const [old] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, a.sessionId));
    expect(old?.revokedAt).not.toBeNull();
    expect(old?.replacedBy).toBe(b.sessionId);
  });

  it("재사용 감지 → 모든 세션 revoke + REUSE_DETECTED", async () => {
    const u = await seedUser();
    const a = await createSession({ userId: u.id, role: u.role });
    // 1차 회전 — 정상.
    await rotateSession(a.refresh);
    // 동일 refresh 를 다시 회전 시도 → 재사용.
    await expect(rotateSession(a.refresh)).rejects.toThrow(/REUSE_DETECTED/);

    // 모든 세션이 revoke 되었는지 확인.
    const [aliveRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(and(eq(sessions.userId, u.id), isNull(sessions.revokedAt)));
    expect(aliveRow?.count).toBe(0);
  });
});
