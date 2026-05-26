# M2 — DB 스키마 v1 (인증 도메인) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`. 모든 step 은 체크박스(`- [ ]`)로 추적.

**Goal:** PRD §5.1 의 4개 테이블(`users`, `sessions`, `email_verifications`, `password_resets`) 과 PostgreSQL 확장(`pgcrypto`, `citext`) 을 Drizzle 스키마로 정의하고, `drizzle-kit` 으로 마이그레이션 SQL 을 생성·적용한다. drizzle-studio 와 Vitest 통합 테스트(real Postgres) 로 검증한다.

**Architecture:** Drizzle ORM(`postgres-js` 드라이버) + PostgreSQL 16 (compose.dev.yml 의 `postgres` 컨테이너). 스키마는 도메인별로 파일을 쪼개고(`schema/users.ts`, `schema/sessions.ts`, `schema/tokens.ts`), `schema/index.ts` 가 re-export 한다. `client.ts` 는 단일 connection (개발) / pool (운영) 을 의도해 두 환경에서 안전하게 동작.

**Tech Stack:** drizzle-orm 0.36+, drizzle-kit 0.28+, postgres 3.4+, vitest 2.1+, PostgreSQL 16.

---

## 사전 조건

- [ ] **선행 마일스톤 완료**: M1 부트스트랩이 끝나 `docker compose -f compose.dev.yml up` 으로 `postgres`, `app` 컨테이너가 healthy.
- [ ] **`.env` 존재**: `DATABASE_URL=postgres://postgres:postgres@postgres:5432/blog` (컨테이너 내부 관점), 호스트에서 직접 접근 시 `localhost:5432`.
- [ ] **`drizzle.config.ts` 존재** (M1 step 1.9 산출물).
- [ ] **`src/server/db/schema/` 디렉터리** 존재 (없으면 `.gitkeep` 으로 만들고 시작).

---

## 파일 구조

**Create:**
- `src/server/db/client.ts` — postgres 연결 + drizzle 인스턴스 (학습 주석으로 dev 단일 커넥션 / prod pool 분기 설명).
- `src/server/db/schema/_enums.ts` — 공용 enum (`user_role`) 정의.
- `src/server/db/schema/users.ts` — users 테이블.
- `src/server/db/schema/sessions.ts` — sessions 테이블 + 인덱스.
- `src/server/db/schema/tokens.ts` — email_verifications, password_resets 두 테이블.
- `src/server/db/schema/index.ts` — 모든 스키마 re-export.
- `src/server/db/migrations/0000_extensions.sql` — `pgcrypto`, `citext` 활성화 (커스텀 마이그레이션, drizzle-kit generate 이전에 수동 작성).
- `src/server/db/migrations/0001_*.sql` — drizzle-kit 이 생성하는 테이블 마이그레이션.
- `src/server/db/migrations/meta/` — drizzle-kit 산출물(자동).
- `tests/db/schema.test.ts` — real Postgres 기반 통합 테스트.
- `tests/setup.ts` — Vitest setup (env 로드).

**Modify:**
- `vitest.config.ts` — `tests/setup.ts` 를 `setupFiles` 로 등록.
- `package.json` — `db:migrate:run`(런타임 마이그레이션 적용 스크립트) 추가, `db:reset`(개발용 DB 초기화) 추가.

**No-Touch (이 마일스톤 범위 밖):**
- `posts`, `categories`, `tags`, `attachments`, `comments`, `likes`, `bookmarks` — M5/M6 에서 다룸.

---

## 작업 단위 (Task) 분해

총 6 Task. 각 Task 끝에 커밋 1회.

- **Task 1**: 확장 활성화 마이그레이션 (`0000_extensions.sql`).
- **Task 2**: `users` 스키마 + 마이그레이션 생성·적용.
- **Task 3**: `sessions` 스키마 + 인덱스 + 마이그레이션.
- **Task 4**: `tokens.ts` (email_verifications, password_resets) + 마이그레이션.
- **Task 5**: `client.ts` + `schema/index.ts` 완비.
- **Task 6**: Vitest 통합 테스트(INSERT/SELECT/UNIQUE/FK 동작 확인).

---

## Task 1 — pgcrypto / citext 확장 활성화

**Why:** `gen_random_uuid()` 는 `pgcrypto`, 대소문자 무시 이메일 컬럼은 `citext` 확장이 필요. drizzle-kit 은 일반 SQL 으로 추출되므로, 확장은 **별도 0000 마이그레이션** 으로 두는 게 깔끔하다.

**Files:**
- Create: `src/server/db/migrations/0000_extensions.sql`

### Steps

- [ ] **1.1 디렉터리 보장**

호스트 셸:
```bash
mkdir -p src/server/db/migrations
```

- [ ] **1.2 0000_extensions.sql 작성**

`src/server/db/migrations/0000_extensions.sql`
```sql
-- gen_random_uuid() 를 위한 pgcrypto, 대소문자 무시 이메일을 위한 citext.
-- 이 두 확장은 모든 후속 마이그레이션이 의존하므로 가장 먼저 적용한다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
```

- [ ] **1.3 적용 확인 명령(이 단계에선 아직 자동 실행 X)**

호스트에서:
```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;"
```
> 학습 차원에서 **수동 적용으로 한 번 동작 검증**한다. Task 2 에서 drizzle-kit 의 정식 migrate 파이프라인이 같은 SQL 을 다시 적용해도 `IF NOT EXISTS` 라 안전.

- [ ] **1.4 검증**

```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "\dx" | grep -E "pgcrypto|citext"
```
Expected: 두 줄 모두 출력.

- [ ] **1.5 커밋**

```bash
git add src/server/db/migrations/0000_extensions.sql
git commit -m "feat(db): enable pgcrypto and citext extensions"
```

---

## Task 2 — `users` 스키마

**Files:**
- Create: `src/server/db/schema/_enums.ts`
- Create: `src/server/db/schema/users.ts`
- Create: `src/server/db/schema/index.ts` (이 시점엔 users 만 export)

### Steps

- [ ] **2.1 enum 정의 파일**

`src/server/db/schema/_enums.ts`
```ts
// 도메인 공용 enum 정의 파일.
// 학습 포인트: Drizzle 의 pgEnum 은 단일 정의 → 모든 테이블에서 재사용.
// enum 값 변경 시 새 마이그레이션이 필요하다(추가는 쉬움, 제거/이름변경은 까다로움).
import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
```

- [ ] **2.2 users 스키마 작성**

`src/server/db/schema/users.ts`
```ts
// users 테이블 — 인증 도메인의 루트.
// 이메일은 citext 로 저장해 대소문자 무시 비교를 DB 레이어에서 보장한다.
// password_hash 는 argon2id 결과 문자열 (마일스톤 3 에서 채움).
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
    // MinIO 객체 키. 공개 URL 은 런타임에 `${S3_PUBLIC_URL}/${bucket}/${key}` 로 합성.
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
    // 관리자 페이지에서 활성/역할 필터링 자주 쓰일 가능성 → 보조 인덱스.
    roleIdx: index("users_role_idx").on(t.role),
  }),
);

// 다른 모듈에서 타입을 재사용하기 위한 inferred 타입.
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **2.3 schema/index.ts 작성 (현재까지)**

`src/server/db/schema/index.ts`
```ts
// 모든 스키마 모듈을 한 군데서 re-export.
// drizzle.config.ts 의 schema glob 이 이 디렉터리 전체를 읽지만,
// 앱 코드에서 import 할 때는 이 index 를 쓰는 게 깔끔하다.
export * from "./_enums";
export * from "./users";
```

- [ ] **2.4 drizzle-kit 으로 마이그레이션 SQL 생성**

호스트에서 (의존성은 이미 설치되어 있다고 가정. 안 되어 있으면 `docker compose -f compose.dev.yml exec app pnpm install`):
```bash
docker compose -f compose.dev.yml exec app pnpm db:generate
```
Expected: `src/server/db/migrations/0001_<random_name>.sql` 와 `meta/_journal.json` 갱신.

- [ ] **2.5 생성된 SQL 검토**

생성된 `0001_*.sql` 을 열어 다음을 확인:
- `CREATE TYPE "public"."user_role" AS ENUM('USER','ADMIN');`
- `CREATE TABLE "users" (...)` — 컬럼 타입 일치, `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");`
- `CREATE INDEX "users_role_idx" ON "users" ("role");`

문제 있으면 스키마 수정 → `pnpm db:generate` 재실행 → 자동 생성된 잘못된 SQL 파일은 손으로 삭제.

- [ ] **2.6 마이그레이션 적용**

```bash
docker compose -f compose.dev.yml exec app pnpm db:migrate
```
Expected: `0000_extensions.sql`, `0001_*.sql` 둘 다 `applied`.

- [ ] **2.7 검증 (psql)**

```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "\d users"
```
Expected: 모든 컬럼 + 인덱스가 의도대로 표시.

```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "INSERT INTO users (email, password_hash, nickname) VALUES ('Test@Example.com','dummy','tester') RETURNING id, email;"
```
Expected: id(uuid) + `email` 이 소문자 비교 가능한 형태로 반환.

```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "SELECT email FROM users WHERE email = 'test@example.com';"
```
Expected: 1 row (citext 가 대소문자 무시 매칭).

- [ ] **2.8 정리 (테스트 데이터 삭제)**

```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "DELETE FROM users WHERE email='test@example.com';"
```

- [ ] **2.9 커밋**

```bash
git add src/server/db/schema/_enums.ts src/server/db/schema/users.ts src/server/db/schema/index.ts src/server/db/migrations/0001_*.sql src/server/db/migrations/meta
git commit -m "feat(db): add users table with citext email and role enum"
```

---

## Task 3 — `sessions` 스키마 (refresh 토큰 회전 추적)

**Why:** 마일스톤 3 의 JWT 회전 흐름이 의존. `refresh_token_hash` 는 평문이 아니라 SHA-256 해시를 저장한다(저장소 유출 대비). `replaced_by` 는 자기 자신 참조 → 회전 체인 추적.

**Files:**
- Create: `src/server/db/schema/sessions.ts`
- Modify: `src/server/db/schema/index.ts`

### Steps

- [ ] **3.1 sessions 스키마**

`src/server/db/schema/sessions.ts`
```ts
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
```

- [ ] **3.2 index.ts 갱신**

`src/server/db/schema/index.ts`
```ts
export * from "./_enums";
export * from "./users";
export * from "./sessions";
```

- [ ] **3.3 generate**

```bash
docker compose -f compose.dev.yml exec app pnpm db:generate
```
Expected: 새 `0002_*.sql` 생성.

- [ ] **3.4 SQL 검토**

`0002_*.sql` 에서 확인:
- `CREATE TABLE "sessions" (...)` 안에 `"ip" inet`, `"replaced_by" uuid` (FK 없음 — self ref 생략).
- `"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE`.
- 두 인덱스 생성문.

- [ ] **3.5 적용**

```bash
docker compose -f compose.dev.yml exec app pnpm db:migrate
```

- [ ] **3.6 검증**

```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "\d sessions"
```
Expected: 컬럼/인덱스/FK 모두 표시.

CASCADE 동작 확인:
```bash
docker compose -f compose.dev.yml exec postgres psql -U postgres -d blog -c "
INSERT INTO users (email,password_hash,nickname) VALUES ('u1@example.com','x','u1') RETURNING id \gset
INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
  VALUES (:'id', 'hash1', now() + interval '30 days');
SELECT count(*) FROM sessions WHERE user_id = :'id';
DELETE FROM users WHERE id = :'id';
SELECT count(*) FROM sessions WHERE user_id = :'id';
"
```
Expected: 첫 SELECT = 1, DELETE 후 SELECT = 0 (CASCADE 동작).

- [ ] **3.7 커밋**

```bash
git add src/server/db/schema/sessions.ts src/server/db/schema/index.ts src/server/db/migrations/0002_*.sql src/server/db/migrations/meta
git commit -m "feat(db): add sessions table for refresh token rotation"
```

---

## Task 4 — `tokens.ts` (email_verifications + password_resets)

**Why:** 두 테이블은 구조가 거의 동일 → 같은 파일에 두면 학습자가 패턴을 비교하기 쉽다. 토큰 평문이 아닌 SHA-256 해시를 저장.

**Files:**
- Create: `src/server/db/schema/tokens.ts`
- Modify: `src/server/db/schema/index.ts`

### Steps

- [ ] **4.1 tokens.ts 작성**

`src/server/db/schema/tokens.ts`
```ts
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
```

- [ ] **4.2 index.ts 갱신**

`src/server/db/schema/index.ts`
```ts
export * from "./_enums";
export * from "./users";
export * from "./sessions";
export * from "./tokens";
```

- [ ] **4.3 generate**

```bash
docker compose -f compose.dev.yml exec app pnpm db:generate
```
Expected: `0003_*.sql` 생성.

- [ ] **4.4 적용**

```bash
docker compose -f compose.dev.yml exec app pnpm db:migrate
```

- [ ] **4.5 검증**

```bash
docker compose -f compose.dev.yml exec postgres \
  psql -U postgres -d blog -c "\d email_verifications" -c "\d password_resets"
```
Expected: 두 테이블 모두 표시, 인덱스 4개.

- [ ] **4.6 커밋**

```bash
git add src/server/db/schema/tokens.ts src/server/db/schema/index.ts src/server/db/migrations/0003_*.sql src/server/db/migrations/meta
git commit -m "feat(db): add email_verifications and password_resets tables"
```

---

## Task 5 — `client.ts` + 런타임 마이그레이션 스크립트

**Why:** 앱 런타임에서 drizzle 인스턴스 단일 import 지점을 만든다. 추가로 `db:migrate:run` 스크립트(부팅 시 자동 적용용) 와 `db:reset`(개발용 초기화) 을 추가.

**Files:**
- Create: `src/server/db/client.ts`
- Create: `src/server/db/migrate.ts`
- Modify: `package.json` (scripts 추가)

### Steps

- [ ] **5.1 client.ts 작성**

`src/server/db/client.ts`
```ts
// 앱 전역에서 사용할 단일 drizzle 인스턴스.
// 학습 포인트:
//  - 개발에선 Hot Reload 가 모듈을 자주 재실행하므로, globalThis 캐시로 연결 누수 방지.
//  - postgres-js 의 기본 옵션은 max=10 커넥션. 환경에 맞춰 조정 가능.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function makeClient() {
  // prepare:false → 마이그레이션 도중 prepared statement 충돌 방지.
  return postgres(env.DATABASE_URL, { max: 10, prepare: false });
}

const client = globalThis.__pgClient ?? makeClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__pgClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

- [ ] **5.2 migrate.ts (런타임 마이그레이션 적용)**

`src/server/db/migrate.ts`
```ts
// CLI 로 실행되는 런타임 마이그레이션 적용 스크립트.
// `pnpm db:migrate:run` 으로 호출.
// drizzle-kit migrate (스튜디오 도구) 와 같은 효과지만, 컨테이너 부팅 시점 등
// 'kit' 없이 마이그레이션을 적용해야 할 때 유용하다.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "@/lib/env";

async function main() {
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  console.log("🔧 마이그레이션 적용 중...");
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  console.log("✅ 마이그레이션 완료");
  await client.end();
}

main().catch((err) => {
  console.error("❌ 마이그레이션 실패", err);
  process.exit(1);
});
```

- [ ] **5.3 package.json scripts 추가**

`package.json` 의 `scripts` 에 추가:
```json
"db:migrate:run": "tsx src/server/db/migrate.ts",
"db:reset": "docker compose -f compose.dev.yml exec postgres psql -U postgres -d postgres -c 'DROP DATABASE IF EXISTS blog;' -c 'CREATE DATABASE blog;'"
```

> `tsx` 가 devDependency 에 없으면 추가: `pnpm add -D tsx`.

- [ ] **5.4 부팅 검증**

```bash
docker compose -f compose.dev.yml exec app pnpm db:migrate:run
```
Expected: "✅ 마이그레이션 완료" (이미 적용된 상태라 변경 없음).

`db:reset` 후 재마이그레이션 동작도 확인:
```bash
pnpm db:reset
docker compose -f compose.dev.yml exec postgres psql -U postgres -d blog -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;"
docker compose -f compose.dev.yml exec app pnpm db:migrate:run
```
> `db:reset` 후 0000_extensions.sql 은 drizzle 의 migrator 가 인식하지 못할 수 있다(파일 형식 차이). 그래서 위 두 번째 라인에서 수동으로 다시 활성화한다. 향후 개선: 0000 도 drizzle-kit 의 `--custom` 마이그레이션으로 정식 등록.

- [ ] **5.5 커밋**

```bash
git add src/server/db/client.ts src/server/db/migrate.ts package.json pnpm-lock.yaml
git commit -m "feat(db): drizzle client + runtime migrate script"
```

---

## Task 6 — Vitest 통합 테스트 (real Postgres)

**Why:** 스키마 자체는 선언적이라 type test 만으로는 의미가 약하다. **실제 DB 에 INSERT/SELECT/UNIQUE/FK** 가 의도대로 동작하는지 확인하는 통합 테스트가 학습 가치가 크다.

**전략:**
- compose.dev.yml 의 postgres 컨테이너를 그대로 사용 (5432 노출).
- 각 테스트는 **고유 schema** (예: `test_<uuid>`) 에 테이블을 만들고, 끝나면 schema drop. 격리.
- 단순화를 위해 이 sub-plan 에서는 **단일 테스트 데이터베이스 + truncate before each** 패턴을 사용. 추후 schema-per-test 로 확장 가능.

**Files:**
- Create: `tests/setup.ts`
- Create: `tests/db/schema.test.ts`
- Modify: `vitest.config.ts` (setupFiles 등록)

### Steps

- [ ] **6.1 vitest.config.ts 갱신**

`vitest.config.ts`
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // DB 접근 테스트는 직렬 실행이 안전.
    fileParallelism: false,
    testTimeout: 15_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **6.2 tests/setup.ts 작성**

`tests/setup.ts`
```ts
// Vitest 부팅 시 .env 를 로드해 process.env 를 채운다.
// 호스트에서 테스트를 돌리는 경우 DATABASE_URL 의 host 가 'postgres'(컨테이너명) 이면 안 되므로
// TEST_DATABASE_URL 이 있으면 우선 사용한다.
import { config } from "dotenv";
config({ path: ".env" });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
```

> `dotenv` 가 없으면: `pnpm add -D dotenv`.

`.env` 에 호스트 실행용 라인 추가:
```dotenv
# 호스트에서 vitest 돌릴 때 사용. compose.dev.yml 의 postgres 가 5432 를 호스트에 노출.
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/blog
```

- [ ] **6.3 실패하는 통합 테스트 먼저 작성**

`tests/db/schema.test.ts`
```ts
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
```

- [ ] **6.4 실패 확인**

```bash
pnpm test
```
Expected (이 시점 결과 예상):
- 만약 마이그레이션이 이미 적용되어 있고 client.ts/스키마가 정상이면 → **모두 PASS**.
- 누락 시 어떤 항목이 실패하는지 확인 (예: dotenv 미설치, TEST_DATABASE_URL 누락).

> TDD 의 의도(실패→통과)를 살리려면, **6.3 을 작성하기 전에 일부러 schema/users 에서 unique 인덱스를 빼고 테스트를 돌려 실패를 본 뒤 되돌리는** 식의 학습 실험을 권장한다. (선택)

- [ ] **6.5 통과 확인 + 커버리지 메모**

```bash
pnpm test
```
Expected: 5 passed.

- [ ] **6.6 커밋**

```bash
git add tests/setup.ts tests/db/schema.test.ts vitest.config.ts .env package.json pnpm-lock.yaml
git commit -m "test(db): integration tests for users/sessions/tokens schema"
```

---

## 마일스톤 종료 체크리스트

- [ ] `pnpm typecheck` 통과 (`docker compose -f compose.dev.yml exec app pnpm typecheck`).
- [ ] `pnpm test` 5 case 통과.
- [ ] `docker compose -f compose.dev.yml --profile tools up drizzle-studio` → `http://localhost:4983` 에서 `users`, `sessions`, `email_verifications`, `password_resets` 4개 테이블 시각 확인.
- [ ] `git log --oneline` 결과에 6개의 잘게 쪼개진 커밋 (확장 / users / sessions / tokens / client+migrate / tests).
- [ ] 모든 새 파일에 한국어 주석.

---

## 다음 단계

이 마일스톤이 끝나면 **M3 — 인증 sub-plan** (`docs/plans/M3-auth.md`) 을 작성하고 진행. M3 는 argon2/jose primitives, 세션 회전, Server Action, Mailpit 메일까지 다루므로 분량이 가장 크다. M2 의 데이터 모델 위에서만 진행 가능하므로 이 sub-plan 의 모든 단계가 완료되어야 한다.

---

문서 끝.
