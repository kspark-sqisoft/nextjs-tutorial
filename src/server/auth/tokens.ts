// 일회용 토큰 (이메일 인증, 비밀번호 재설정) 공용 로직.
// 평문은 메일/링크에만 노출하고, DB 에는 SHA-256 해시만 저장한다.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  emailVerifications,
  passwordResets,
} from "@/server/db/schema";

function sha256(plain: string) {
  return createHash("sha256").update(plain).digest("hex");
}

function newToken() {
  // URL-safe 32 바이트 = 256bit, base64url.
  return randomBytes(32).toString("base64url");
}

export async function issueEmailVerification(userId: string) {
  const plain = newToken();
  const tokenHash = sha256(plain);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24h
  await db
    .insert(emailVerifications)
    .values({ userId, tokenHash, expiresAt });
  return plain; // 메일 본문에만 들어간다.
}

export async function consumeEmailVerification(plain: string) {
  const tokenHash = sha256(plain);
  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.tokenHash, tokenHash),
        isNull(emailVerifications.usedAt),
        gt(emailVerifications.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(eq(emailVerifications.id, row.id));
  return { userId: row.userId };
}

export async function issuePasswordReset(userId: string) {
  const plain = newToken();
  const tokenHash = sha256(plain);
  const expiresAt = new Date(Date.now() + 1 * 3600 * 1000); // 1h
  await db
    .insert(passwordResets)
    .values({ userId, tokenHash, expiresAt });
  return plain;
}

export async function consumePasswordReset(plain: string) {
  const tokenHash = sha256(plain);
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, row.id));
  return { userId: row.userId };
}
