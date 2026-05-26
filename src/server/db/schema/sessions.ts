// sessions — refresh 토큰의 서버측 상태.
// id 는 refresh JWT 의 jti 와 동일하게 사용해, 검증 시 빠르게 행을 찾는다.
// refresh_token_hash 는 SHA-256(refresh 평문) 을 저장 (평문은 절대 X).
// replaced_by 로 회전 체인을 추적 → 재사용 감지 가능.
import { sql } from "drizzle-orm";
import {
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// Drizzle 에 inet 직접 타입이 없어 customType 으로 매핑.
const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return "inet";
  },
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: inet("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // 회전 후 새로 만들어진 세션 id. 자기 테이블 참조라 references 는 생략 (사이클 회피).
    replacedBy: uuid("replaced_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdIdx: index("sessions_user_id_idx").on(t.userId),
    // 만료 청소 배치(향후)에서 사용할 보조 인덱스.
    expiresAtIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
