// 카테고리 — slug 로 식별. citext 라 대소문자 무시.
import { sql } from "drizzle-orm";
import { customType, pgTable, text, uuid } from "drizzle-orm/pg-core";

const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: citext("slug").notNull().unique(),
  name: text("name").notNull(),
});

export type Category = typeof categories.$inferSelect;
