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

// TipTap 본문에는 작성 당시의 절대 URL 이 그대로 박힌다.
// 환경(개발용 호스트 변경, 모바일 LAN 접속 등)에 따라 호스트가 달라지므로
// 렌더 직전에 우리 S3 객체 URL 만 현재 S3_PUBLIC_URL 로 정규화한다.
// 외부에서 가져온 임의 이미지 src 는 path 패턴이 다르므로 영향받지 않는다.
export function normalizeS3Url(src: string): string {
  try {
    const u = new URL(src);
    if (u.pathname.startsWith(`/${env.S3_BUCKET}/`)) {
      return `${env.S3_PUBLIC_URL}${u.pathname}`;
    }
    return src;
  } catch {
    return src;
  }
}
