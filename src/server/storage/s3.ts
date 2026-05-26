// S3-호환 클라이언트. MinIO 는 path-style 만 지원하므로 forcePathStyle: true.
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

// 객체 키를 외부 공개 URL 로 변환.
// dev 에선 minio 가 익명 다운로드 허용이라 그대로 접근 가능.
export function publicUrl(objectKey: string) {
  return `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/${objectKey}`;
}
