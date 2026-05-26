// 업로드된 객체의 메타데이터.
// post_id 는 NULL 가능 — AVATAR 또는 글 작성 중 인라인 업로드(아직 post 가 없음) 케이스.
// M5 에서 posts 테이블 생긴 뒤 FK 를 ALTER 로 추가한다.
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { attachmentKindEnum } from "./_enums";
import { users } from "./users";

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // 지금은 단순 uuid 컬럼 (FK 없음). M5 에서 posts FK 추가.
    postId: uuid("post_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    kind: attachmentKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    ownerIdx: index("attachments_owner_id_idx").on(t.ownerId),
    postIdx: index("attachments_post_id_idx").on(t.postId),
    keyUnique: uniqueIndex("attachments_object_key_unique").on(t.objectKey),
  }),
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
