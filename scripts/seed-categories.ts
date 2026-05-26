// 첫 실행 시 기본 카테고리 3개 등록 (idempotent).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { categories } from "@/server/db/schema";

const DEFAULTS = [
  { slug: "general", name: "일반" },
  { slug: "learning", name: "학습" },
  { slug: "retro", name: "회고" },
];

async function main() {
  for (const c of DEFAULTS) {
    const [exists] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, c.slug))
      .limit(1);
    if (!exists) await db.insert(categories).values(c);
  }
  console.log("✅ categories seeded");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
