// 마이그레이션 산출물 위치와 DB 연결 정보를 drizzle-kit 에 알려준다.
// schema 는 도메인 파일별로 분리되므로 glob 으로 잡는다.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema/*",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  verbose: true,
  strict: true,
});
