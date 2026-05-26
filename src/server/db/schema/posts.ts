// posts 테이블 — Tiptap 본문(JSON)과 검색용 plain text 를 분리 저장.
// search_tsv 는 GENERATED tsvector — 마이그레이션 SQL 끝에서 수동 추가.
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { categories } from "./categories";

// tsvector 컬럼은 Drizzle 기본 타입에 없어 customType.
// GENERATED ALWAYS AS ... STORED 정의는 정의 단계에서 표현 어려워, 마이그레이션 SQL 에 직접 작성.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: citext("slug").notNull().unique(),
    contentJson: jsonb("content_json").notNull(),
    contentText: text("content_text").notNull(),
    isPublished: boolean("is_published").notNull().default(true),
    isHidden: boolean("is_hidden").notNull().default(false),
    // 마이그레이션 SQL 에서 GENERATED ALWAYS AS ... STORED 로 갱신.
    searchTsv: tsvector("search_tsv"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    createdAtIdx: index("posts_created_at_idx").on(t.createdAt),
    authorIdx: index("posts_author_id_idx").on(t.authorId),
    categoryIdx: index("posts_category_id_idx").on(t.categoryId),
    isHiddenIdx: index("posts_is_hidden_idx").on(t.isHidden),
  }),
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
