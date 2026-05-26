// posts ↔ tags 다대다 조인 테이블. (post_id, tag_id) 복합 PK.
import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { tags } from "./tags";

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.tagId] }),
  }),
);
