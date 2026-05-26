// 세션 = refresh 토큰의 서버측 상태.
// 회전 정책:
//  1) 발급 시 sessions row 생성, refresh JWT 의 jti = sessions.id.
//  2) /api/auth/refresh 호출 → 검증 후 새 sessionId 발급, 기존 세션 revoke + replaced_by 설정.
//  3) 이미 revoked 인 세션을 다시 회전 시도 → 재사용 공격으로 보고 user 의 모든 세션 revoke.
import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { signAccess, signRefresh, verifyRefresh, type Role } from "./jwt";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export interface IssuedTokens {
  access: string;
  refresh: string;
  sessionId: string;
}

export async function createSession(p: {
  userId: string;
  role: Role;
  ua?: string;
  ip?: string;
  ttlSeconds?: number;
}): Promise<IssuedTokens> {
  const sessionId = randomUUID();
  const refresh = await signRefresh({ sub: p.userId, jti: sessionId });
  await db.insert(sessions).values({
    id: sessionId,
    userId: p.userId,
    refreshTokenHash: sha256(refresh),
    userAgent: p.ua ?? null,
    ip: p.ip ?? null,
    expiresAt: new Date(
      Date.now() + (p.ttlSeconds ?? 30 * 24 * 3600) * 1000,
    ),
  });
  const access = await signAccess({ sub: p.userId, role: p.role });
  return { access, refresh, sessionId };
}

/** 회전 — 성공 시 새 토큰, 재사용 감지 시 throw('REUSE_DETECTED'). */
export async function rotateSession(refreshPlain: string): Promise<IssuedTokens> {
  const payload = await verifyRefresh(refreshPlain);
  const presentedHash = sha256(refreshPlain);
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, payload.jti))
    .limit(1);
  if (!row) throw new Error("UNKNOWN_SESSION");

  // 이미 revoke 된 세션을 다시 쓰려 함 → 재사용 공격.
  if (row.revokedAt) {
    await revokeAllForUser(row.userId);
    throw new Error("REUSE_DETECTED");
  }
  if (row.refreshTokenHash !== presentedHash) throw new Error("BAD_REFRESH");
  if (row.expiresAt.getTime() < Date.now()) throw new Error("EXPIRED");

  // role 은 최신 DB 값을 기준으로 (관리자 권한이 바뀌었을 수 있음).
  const [u] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  if (!u || !u.isActive) throw new Error("USER_DISABLED");

  // 새 세션 발급.
  const next = await createSession({ userId: row.userId, role: u.role });
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), replacedBy: next.sessionId })
    .where(eq(sessions.id, row.id));
  return next;
}

export async function revokeSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeAllForUser(userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
