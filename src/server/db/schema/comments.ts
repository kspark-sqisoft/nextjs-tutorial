// comments 테이블.
// 학습 포인트:
//  - parent_id 가 자기 자신을 참조 → AnyPgColumn 으로 lazy 참조.
//  - 대댓글은 1단계까지만 — 앱 레이어(comment.create) 에서 parent.parent_id != null 이면 거부.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => comments.id,
      { onDelete: "cascade" },
    ),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    postIdx: index("comments_post_id_idx").on(t.postId),
    parentIdx: index("comments_parent_id_idx").on(t.parentId),
  }),
);

export type Comment = typeof comments.$inferSelect;
