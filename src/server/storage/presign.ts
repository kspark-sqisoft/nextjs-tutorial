// presigned URL 발급 도우미.
// 학습 포인트:
//  - 키 prefix 를 kind 별로 다르게 두어 GC/정책 적용이 쉽도록 한다.
//  - TTL 은 5분 — 발급 후 빠르게 업로드되어야 한다.
import { randomUUID } from "node:crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { env } from "@/lib/env";
import { s3Public } from "./s3";
import { UPLOAD_CONSTRAINTS, type UploadKind } from "./constraints";

const PREFIX: Record<UploadKind, string> = {
  AVATAR: "avatars",
  POST_INLINE: "posts/inline",
  POST_ATTACHMENT: "posts/files",
};

function extFromMime(mime: string) {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/pdf":
      return "pdf";
    case "application/zip":
      return "zip";
    case "text/plain":
      return "txt";
    case "text/csv":
      return "csv";
    case "text/markdown":
      return "md";
    case "application/json":
      return "json";
    default:
      return "bin";
  }
}

export function keyFor(kind: UploadKind, mime: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${PREFIX[kind]}/${yyyy}/${mm}/${randomUUID()}.${extFromMime(mime)}`;
}

export async function requestUpload(p: {
  kind: UploadKind;
  mime: string;
  sizeBytes: number;
}) {
  const c = UPLOAD_CONSTRAINTS[p.kind];
  if (!c.mimeWhitelist.has(p.mime)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "허용되지 않는 파일 형식입니다.",
    });
  }
  if (p.sizeBytes <= 0 || p.sizeBytes > c.maxBytes) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `파일 크기는 ${(c.maxBytes / 1024 / 1024).toFixed(0)}MB 이하여야 합니다.`,
    });
  }
  const objectKey = keyFor(p.kind, p.mime);
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: objectKey,
    ContentType: p.mime,
  });
  // 브라우저가 직접 PUT 할 URL 이므로 브라우저가 접근 가능한 호스트(S3_PUBLIC_URL)로 서명한다.
  const uploadUrl = await getSignedUrl(s3Public, command, {
    expiresIn: 300,
  });
  return {
    uploadUrl,
    objectKey,
    headers: { "Content-Type": p.mime } as Record<string, string>,
  };
}

/** 비공개 객체용 — 본 프로젝트는 공개 다운로드라 사용 빈도 낮지만 학습용으로 남긴다. */
export async function presignedGet(objectKey: string) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: objectKey,
  });
  // 다운로드도 브라우저 접근이라 s3Public 사용.
  return getSignedUrl(s3Public, command, { expiresIn: 60 });
}
