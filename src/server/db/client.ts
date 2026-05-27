// 앱 전역에서 사용할 단일 drizzle 인스턴스.
// 학습 포인트:
//  - 개발에선 Hot Reload 가 모듈을 자주 재실행하므로, globalThis 캐시로 연결 누수 방지.
//  - postgres-js 의 기본 옵션은 max=10 커넥션. 환경에 맞춰 조정 가능.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  // Hot reload 사이에 connection 이 끊기지 않도록 globalThis 캐시.
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
