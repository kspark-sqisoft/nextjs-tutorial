// 태그 — slug 로 식별. 사용자 입력에서 생성되며 작성 시점에 upsert.
import { sql } from "drizzle-orm";
import { customType, pgTable, text, uuid } from "drizzle-orm/pg-core";

const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: citext("slug").notNull().unique(),
  name: text("name").notNull(),
});

export type Tag = typeof tags.$inferSelect;
