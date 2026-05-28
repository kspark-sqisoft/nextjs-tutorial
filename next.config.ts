import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Next.js 설정 — 학습용으로 standalone 빌드를 켜 둔다.
// standalone 출력은 프로덕션 Docker 이미지(마일스톤 10)에서 사용한다.
const nextConfig: NextConfig = {
  output: "standalone",
  // 학습 포인트: 브라우저가 보는 이미지 URL 은 항상 상대경로(`/s3/...`).
  // 'localhost' 는 클라이언트마다 다른 머신을 가리키므로(PC에선 PC, 모바일에선 모바일)
  // 절대 호스트를 박지 않고 Next 가 자체 호스트로 받아 MinIO 로 프록시한다.
  // 그래서 next/image 의 remotePatterns 도 필요 없다(자기 호스트는 자동 허용).
  images: {
    remotePatterns: [],
  },
  // MinIO 객체 다운로드 프록시.
  //   브라우저 → Next(:3000)/s3/<key> → MinIO(컨테이너 내부 호스트)/blog/<key>
  // 데스크탑/모바일/LAN/공인망 어디서 접속하든 같은 상대경로로 동작한다.
  // S3_ENDPOINT 는 컨테이너 내부 호스트(http://minio:9000)이고 빌드 시점에 .env 에서 읽는다.
  async rewrites() {
    const endpoint = process.env.S3_ENDPOINT ?? "http://minio:9000";
    const bucket = process.env.S3_BUCKET ?? "blog";
    return [
      { source: "/s3/:path*", destination: `${endpoint}/${bucket}/:path*` },
    ];
  },
  experimental: {
    // Server Actions 의 요청 본문 크기 상한.
    // 본 프로젝트는 파일 업로드를 presigned PUT 으로 처리하므로 큰 값 필요 없음.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Windows 호스트 + Docker bind mount 조합에선 inotify 이벤트가 컨테이너로
  // 전달되지 않는다. webpack 의 폴링 watcher 로 우회한다.
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
      ignored: ["**/node_modules", "**/.next", "**/.git"],
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
