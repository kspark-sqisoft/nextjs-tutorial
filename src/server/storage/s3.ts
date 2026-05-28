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

// 객체 키를 브라우저용 상대 URL 로 변환.
// 학습 포인트: 절대 호스트(localhost/LAN IP)를 박지 않는다.
//   - 'localhost' 는 클라이언트마다 다른 머신을 가리킨다(PC에선 PC, 모바일에선 모바일).
//   - LAN IP 는 동적 IP 환경에서 수시로 바뀐다.
// Next 가 자체 호스트로 받아 next.config.ts 의 rewrite 로 MinIO 에 프록시한다.
export function publicUrl(objectKey: string) {
  return `/s3/${objectKey}`;
}

// TipTap 본문의 image 노드에는 작성 당시 절대 URL 이 박힐 수 있다(과거 데이터 호환).
// 우리 버킷의 객체 URL 만 상대경로(/s3/<key>)로 치환하고, 외부 이미지 src 는 건드리지 않는다.
//   허용 입력 예) http://localhost:9000/blog/posts/.../a.jpg, http://192.168.x.y:9000/blog/...
export function normalizeS3Url(src: string): string {
  // 이미 상대경로면 그대로.
  if (src.startsWith("/")) return src;
  try {
    const u = new URL(src);
    if (u.pathname.startsWith(`/${env.S3_BUCKET}/`)) {
      // /blog/<key> → /s3/<key>
      return `/s3/${u.pathname.slice(env.S3_BUCKET.length + 2)}`;
    }
    return src;
  } catch {
    return src;
  }
}
