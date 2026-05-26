// users 테이블 — 인증 도메인의 루트.
// 이메일은 citext 로 저장해 대소문자 무시 비교를 DB 레이어에서 보장한다.
// password_hash 는 argon2id 결과 문자열 (M3 에서 채움).
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userRoleEnum } from "./_enums";

// Drizzle 기본 제공 타입엔 citext 가 없어 customType 으로 직접 매핑.
// dataType() 만 정의하면 SELECT/INSERT 모두 정상 동작 (TS 측은 string).
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: citext("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    nickname: text("nickname").notNull(),
    bio: text("bio"),
    // MinIO 객체 키 (M4). 공개 URL 은 런타임에 `${S3_PUBLIC_URL}/${bucket}/${key}` 로 합성.
    avatarKey: text("avatar_key"),
    role: userRoleEnum("role").notNull().default("USER"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    // citext 라 대소문자 무시되지만, 인덱스는 명시적으로 unique 로 둔다.
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
    // 관리자 페이지(M8)에서 활성/역할 필터링 자주 쓰일 가능성 → 보조 인덱스.
    roleIdx: index("users_role_idx").on(t.role),
  }),
);

// 다른 모듈에서 타입을 재사용하기 위한 inferred 타입.
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
