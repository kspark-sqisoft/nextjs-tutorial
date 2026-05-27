// post 라우터 통합 테스트.
// 학습 포인트:
//  - 실제 DB 트랜잭션 + 트리거 (tsvector, content_text) 까지 검증되도록 mock 없이 호출.
//  - 매 케이스 beforeEach 로 TRUNCATE → 격리 보장.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { callerForUser, publicCaller } from "../helpers/caller";

async function truncate() {
  // 외래키 의존 순서를 신경 쓰지 않도록 CASCADE.
  await db.execute(sql`
    TRUNCATE TABLE
      post_tags, attachments, comments, likes, bookmarks,
      posts, tags, categories,
      sessions, email_verifications, password_resets, users
    RESTART IDENTITY CASCADE
  `);
}

async function seedUser(email = "a@example.com", nickname = "a") {
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash: "x", nickname })
    .returning({ id: users.id });
  return u!;
}

// Tiptap 최소 문서 — extractText 가 "hello" 를 뽑아 content_text 에 들어간다.
const minimalDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "hello" }],
    },
  ],
};

describe("post router", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("create → bySlug 동일 데이터", async () => {
    const u = await seedUser();
    const c = callerForUser(u.id);
    const { slug } = await c.post.create({
      title: "첫 글",
      contentJson: minimalDoc,
      categorySlug: null,
      tagSlugs: ["devlog"],
      isPublished: true,
      attachmentKeys: [],
    });
    const got = await c.post.bySlug({ slug });
    expect(got.title).toBe("첫 글");
    expect(got.tags.map((t) => t.slug)).toContain("devlog");
  });

  it("비작성자 update 시 FORBIDDEN", async () => {
    const u1 = await seedUser("a@example.com", "a");
    const u2 = await seedUser("b@example.com", "b");
    const c1 = callerForUser(u1.id);
    const { id } = await c1.post.create({
      title: "x",
      contentJson: minimalDoc,
      categorySlug: null,
      tagSlugs: [],
      isPublished: true,
      attachmentKeys: [],
    });
    const c2 = callerForUser(u2.id);
    await expect(
      c2.post.update({
        id,
        title: "y",
        contentJson: minimalDoc,
        categorySlug: null,
        tagSlugs: [],
        isPublished: true,
        attachmentKeys: [],
      }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("public 은 숨김 글 NOT_FOUND, 작성자는 조회 가능", async () => {
    const u = await seedUser();
    const c = callerForUser(u.id);
    const { slug, id } = await c.post.create({
      title: "비밀",
      contentJson: minimalDoc,
      categorySlug: null,
      tagSlugs: [],
      isPublished: true,
      attachmentKeys: [],
    });
    await db.execute(sql`UPDATE posts SET is_hidden = true WHERE id = ${id}`);
    const guest = publicCaller();
    await expect(guest.post.bySlug({ slug })).rejects.toThrow(/NOT_FOUND/);
    await expect(c.post.bySlug({ slug })).resolves.toBeTruthy();
  });
});
