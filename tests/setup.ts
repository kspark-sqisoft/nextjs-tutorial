// Vitest 부팅 시 .env 를 로드해 process.env 를 채운다.
// 학습 포인트:
//  - 통합 테스트는 매 케이스 TRUNCATE 를 돌리므로 dev DB 와 반드시 분리.
//  - 자동 마이그레이션으로 blog_test 가 비어 있어도 한 번에 사용 가능.
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env" });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// 안전장치: dev DB(blog) 를 가리키면 즉시 throw.
// 과거에 같은 DB 를 가리키게 둬 회원가입 데이터가 TRUNCATE 로 날아간 사고 방지.
const url = process.env.DATABASE_URL ?? "";
if (/\/blog(\?|$)/.test(url)) {
  throw new Error(
    "TEST_DATABASE_URL must point to a separate database (e.g., blog_test). " +
      "Refusing to run tests against the dev 'blog' database.",
  );
}

// blog_test 에 마이그레이션 자동 적용 (idempotent — 이미 적용된 건 skip).
const client = postgres(url, { max: 1 });
await migrate(drizzle(client), {
  migrationsFolder: "./src/server/db/migrations",
});
await client.end();
