// CLI 로 실행되는 런타임 마이그레이션 적용 스크립트.
// `pnpm db:migrate:run` 으로 호출.
// drizzle-kit migrate (스튜디오 도구) 와 같은 효과지만, 컨테이너 부팅 시점 등
// 'kit' 없이 마이그레이션을 적용해야 할 때 유용하다.
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1 });
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
