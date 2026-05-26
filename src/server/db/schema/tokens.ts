// 일회용 토큰 두 종 (이메일 인증, 비밀번호 재설정).
// 공통 컬럼이 거의 같지만, 의미가 다른 도메인이므로 테이블은 분리한다.
// 평문 토큰은 응답으로만 한 번 노출되고, DB 에는 SHA-256 해시만 저장.
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdIdx: index("email_verifications_user_id_idx").on(t.userId),
    tokenHashIdx: index("email_verifications_token_hash_idx").on(t.tokenHash),
  }),
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdIdx: index("password_resets_user_id_idx").on(t.userId),
    tokenHashIdx: index("password_resets_token_hash_idx").on(t.tokenHash),
  }),
);

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type NewPasswordReset = typeof passwordResets.$inferInsert;
