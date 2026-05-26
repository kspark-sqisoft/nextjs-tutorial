import type { NextConfig } from "next";

// Next.js 설정 — 학습용으로 standalone 빌드를 켜 둔다.
// standalone 출력은 프로덕션 Docker 이미지(마일스톤 10)에서 사용한다.
const nextConfig: NextConfig = {
  output: "standalone",
  // 외부 이미지 호스트 (MinIO 공개 URL) 허용.
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "minio", port: "9000" },
    ],
  },
  experimental: {
    // Server Actions 의 요청 본문 크기 상한.
    // 본 프로젝트는 파일 업로드를 presigned PUT 으로 처리하므로 큰 값 필요 없음.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
