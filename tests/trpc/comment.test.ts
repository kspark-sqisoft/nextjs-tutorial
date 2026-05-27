// comment 라우터 통합 테스트.
// 학습 포인트:
//  - 대댓글 1단계 제한 (parent.parent_id != null 거부).
//  - 작성자 / 관리자 외 삭제 거부.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { callerForUser } from "../helpers/caller";

const doc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "x" }],
    },
  ],
};

async function truncate() {
  await db.execute(sql`
    TRUNCATE TABLE
      post_tags, comments, likes, bookmarks, attachments,
      posts, tags, categories,
      sessions, email_verifications, password_resets, users
    RESTART IDENTITY CASCADE
  `);
}

async function seedUser(email: string, nickname: string) {
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash: "x", nickname })
    .returning({ id: users.id });
  return u!;
}

describe("comment router", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("대댓글 1단계 제한", async () => {
    const u = await seedUser("u@x.com", "u");
    const c = callerForUser(u.id);
    const { id: postId } = await c.post.create({
      title: "p",
      contentJson: doc,
      categorySlug: null,
      tagSlugs: [],
      isPublished: true,
      attachmentKeys: [],
    });
    const root = await c.comment.create({ postId, content: "1" });
    const child = await c.comment.create({
      postId,
      parentId: root.id,
      content: "2",
    });
    await expect(
      c.comment.create({
        postId,
        parentId: child.id,
        content: "3",
      }),
    ).rejects.toThrow(/1단계/);
  });

  it("작성자만 삭제 가능", async () => {
    const u1 = await seedUser("1@x.com", "1");
    const u2 = await seedUser("2@x.com", "2");
    const c1 = callerForUser(u1.id);
    const c2 = callerForUser(u2.id);
    const { id: postId } = await c1.post.create({
      title: "p",
      contentJson: doc,
      categorySlug: null,
      tagSlugs: [],
      isPublished: true,
      attachmentKeys: [],
    });
    const created = await c1.comment.create({ postId, content: "hi" });
    await expect(c2.comment.delete({ id: created.id })).rejects.toThrow(
      /FORBIDDEN/,
    );
    await expect(c1.comment.delete({ id: created.id })).resolves.toEqual({
      ok: true,
    });
  });
});
