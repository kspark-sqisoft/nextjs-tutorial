// 제목 → slug. 한글은 slugify 옵션으로 transliteration 하지 않고, 충돌 시 randomized suffix.
import slugify from "slugify";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema";

export async function uniquePostSlug(title: string) {
  const base =
    slugify(title, { lower: true, strict: true, locale: "ko" }) ||
    `post-${Date.now()}`;
  // 빠른 길로 충돌 검사 후 충돌 시 6자 suffix.
  const [exists] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.slug, base))
    .limit(1);
  if (!exists) return base;
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
