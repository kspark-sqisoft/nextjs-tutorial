import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import {
  createSession,
  rotateSession,
  revokeAllForUser,
} from "@/server/auth/session";

async function truncate() {
  await db.execute(
    sql`TRUNCATE TABLE email_verifications, password_resets, sessions, users RESTART IDENTITY CASCADE`,
  );
}

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: "s@example.com", passwordHash: "x", nickname: "s" })
    .returning({ id: users.id, role: users.role });
  return u!;
}

describe("session rotation", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("rotate 시 기존 세션 revoke + replaced_by 설정", async () => {
    const u = await seedUser();
    const a = await createSession({ userId: u.id, role: u.role });
    const b = await rotateSession(a.refresh);
    const [oldRow] = await db
      .select()
      .from(sessions)
      .where(sql`id = ${a.sessionId}`);
    expect(oldRow!.revokedAt).not.toBeNull();
    expect(oldRow!.replacedBy).toBe(b.sessionId);
  });

  it("같은 refresh 두 번 회전 시 user 전체 revoke", async () => {
    const u = await seedUser();
    const a = await createSession({ userId: u.id, role: u.role });
    const b = await rotateSession(a.refresh);
    // a.refresh 는 이미 revoked.
    await expect(rotateSession(a.refresh)).rejects.toThrow("REUSE_DETECTED");
    // b 도 같이 revoke 되어야 함.
    const [bRow] = await db
      .select()
      .from(sessions)
      .where(sql`id = ${b.sessionId}`);
    expect(bRow!.revokedAt).not.toBeNull();
  });

  it("revokeAllForUser 는 모든 활성 세션을 revoke", async () => {
    const u = await seedUser();
    await createSession({ userId: u.id, role: u.role });
    await createSession({ userId: u.id, role: u.role });
    await revokeAllForUser(u.id);
    const rows = await db.select().from(sessions);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });
});
