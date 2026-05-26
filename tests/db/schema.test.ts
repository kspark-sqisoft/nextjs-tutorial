// 실제 PostgreSQL 에 연결해 스키마가 의도대로 동작하는지 확인.
// 사전 조건: `docker compose -f compose.dev.yml up postgres` 가 떠 있고, 마이그레이션이 적용된 상태.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  emailVerifications,
  passwordResets,
  sessions,
  users,
} from "@/server/db/schema";

async function truncateAll() {
  // CASCADE 로 FK 자식까지 정리. RESTART IDENTITY 는 enum/uuid 와 무관.
  await db.execute(
    sql`TRUNCATE TABLE email_verifications, password_resets, sessions, users RESTART IDENTITY CASCADE`,
  );
}

describe("DB schema v1", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await truncateAll();
  });

  it("users: 이메일 대소문자 무시(citext) 동작", async () => {
    await db.insert(users).values({
      email: "Test@Example.com",
      passwordHash: "x",
      nickname: "tester",
    });
    const rows = await db.execute(
      sql`SELECT id FROM users WHERE email = 'test@example.com'`,
    );
    expect(rows.length).toBe(1);
  });

  it("users: 이메일 unique 제약", async () => {
    await db
      .insert(users)
      .values({ email: "dup@example.com", passwordHash: "x", nickname: "a" });
    await expect(
      db
        .insert(users)
        .values({ email: "dup@example.com", passwordHash: "x", nickname: "b" }),
    ).rejects.toThrow();
  });

  it("users: role 기본값은 USER", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "r1@example.com", passwordHash: "x", nickname: "r1" })
      .returning({ role: users.role });
    expect(u!.role).toBe("USER");
  });

  it("sessions: ON DELETE CASCADE 동작", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "c@example.com", passwordHash: "x", nickname: "c" })
      .returning({ id: users.id });
    await db.insert(sessions).values({
      userId: u!.id,
      refreshTokenHash: "hash",
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });
    const before = await db.execute(
      sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${u!.id}`,
    );
    expect((before[0] as { n: number }).n).toBe(1);

    await db.execute(sql`DELETE FROM users WHERE id = ${u!.id}`);
    const after = await db.execute(
      sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${u!.id}`,
    );
    expect((after[0] as { n: number }).n).toBe(0);
  });

  it("email_verifications / password_resets: INSERT 가능", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "t@example.com", passwordHash: "x", nickname: "t" })
      .returning({ id: users.id });
    const expires = new Date(Date.now() + 3600_000);
    await db
      .insert(emailVerifications)
      .values({ userId: u!.id, tokenHash: "h1", expiresAt: expires });
    await db
      .insert(passwordResets)
      .values({ userId: u!.id, tokenHash: "h2", expiresAt: expires });
    const ev = await db.select().from(emailVerifications);
    const pr = await db.select().from(passwordResets);
    expect(ev.length).toBe(1);
    expect(pr.length).toBe(1);
  });
});
