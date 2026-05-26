// S3-호환 클라이언트.
// MinIO 는 path-style 만 지원하므로 forcePathStyle: true.
//
// 학습 포인트: 두 개의 클라이언트를 둔다.
//  - s3 (서버 내부 통신용): endpoint = S3_ENDPOINT (예: http://minio:9000)
//    컨테이너에서 MinIO 와 직접 통신.
//  - s3Public (presigning 전용): endpoint = S3_PUBLIC_URL (예: http://localhost:9000)
//    브라우저가 PUT 할 수 있는 호스트로 서명. 실제 네트워크 통신은 일어나지 않고
//    URL 문자열만 생성하므로 컨테이너에서 localhost 가 가리키는 곳을 신경 쓸 필요 없음.
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

const credentials = {
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
};

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials,
});

export const s3Public = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_PUBLIC_URL,
  forcePathStyle: true,
  credentials,
});

// 객체 키를 외부 공개 URL 로 변환.
// dev 에선 minio 가 익명 다운로드 허용이라 그대로 접근 가능.
export function publicUrl(objectKey: string) {
  return `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/${objectKey}`;
}
