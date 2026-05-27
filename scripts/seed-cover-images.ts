// D:\media 의 이미지를 랜덤하게 기존 글에 cover 로 배치.
//
// 학습 포인트:
//  - S3 PutObjectCommand 로 임의 객체 업로드 (presigned 가 아닌 서버측 직접 업로드).
//  - posts.content_json 의 content 배열 앞에 image 노드를 삽입하면
//    글 상세는 그대로 렌더 (sanitize 가 image 허용),
//    카드 그리드는 post.list 쿼리가 첫 image src 를 jsonb_array_elements 로 추출.
//
// 실행 (호스트):
//   $env:DATABASE_URL="postgres://postgres:postgres@localhost:5432/blog";
//   $env:S3_ENDPOINT="http://localhost:9000";
//   pnpm tsx scripts/seed-cover-images.ts
//
// MEDIA_DIR 환경변수로 다른 폴더 지정 가능 (기본: D:/media).
import "dotenv/config";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { posts, attachments } from "@/server/db/schema";
import { s3, publicUrl } from "@/server/storage/s3";
import { env } from "@/lib/env";
import { extractText } from "@/server/posts/extract-text";

const MEDIA_DIR = process.env.MEDIA_DIR ?? "D:/media";

// 화이트리스트 — 동영상/기타는 무시.
const MIMES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function listImages(dir: string) {
  return readdirSync(dir)
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      const full = path.join(dir, f);
      return MIMES[ext] !== undefined && statSync(full).isFile();
    })
    .map((f) => path.join(dir, f));
}

type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
};

async function main() {
  const imgs = listImages(MEDIA_DIR);
  if (!imgs.length) {
    console.error(`no images found in ${MEDIA_DIR}`);
    process.exit(1);
  }
  console.log(`✓ found ${imgs.length} images in ${MEDIA_DIR}`);

  const allPosts = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      contentJson: posts.contentJson,
    })
    .from(posts);
  console.log(`✓ ${allPosts.length} posts to update`);

  for (const p of allPosts) {
    const cj = (p.contentJson ?? { type: "doc", content: [] }) as TiptapNode;
    const content = Array.isArray(cj.content) ? cj.content : [];

    // 이미 첫 노드가 image 면 스킵 — 멱등성 보장.
    if (content[0]?.type === "image") {
      console.log(`  · skip ${p.id.slice(0, 8)} (already has cover)`);
      continue;
    }

    const file = imgs[Math.floor(Math.random() * imgs.length)]!;
    const ext = path.extname(file).toLowerCase();
    const mime = MIMES[ext]!;
    const body = readFileSync(file);
    const objectKey = `posts/cover/${randomUUID()}${ext}`;

    // 1) MinIO 에 객체 업로드.
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: mime,
      }),
    );

    // 2) attachments row — post_id 매핑.
    await db.insert(attachments).values({
      postId: p.id,
      ownerId: p.authorId,
      objectKey,
      originalName: path.basename(file),
      mimeType: mime,
      sizeBytes: body.byteLength,
      kind: "POST_INLINE",
    });

    // 3) content_json 의 content 배열 앞에 image 노드 삽입.
    const nextJson: TiptapNode = {
      ...cj,
      type: cj.type ?? "doc",
      content: [
        {
          type: "image",
          attrs: { src: publicUrl(objectKey), alt: null, title: null },
        },
        ...content,
      ],
    };

    await db
      .update(posts)
      .set({
        contentJson: nextJson as unknown as object,
        contentText: extractText(nextJson),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, p.id));

    console.log(`  • post ${p.id.slice(0, 8)} ← ${path.basename(file)}`);
  }

  console.log("✅ done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
