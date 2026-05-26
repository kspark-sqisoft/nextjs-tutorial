// kind 별 허용 MIME / 최대 사이즈.
// 학습 차원에서 클라이언트·서버 양쪽에서 동일 화이트리스트를 사용한다.
export const UPLOAD_CONSTRAINTS = {
  AVATAR: {
    maxBytes: 2 * 1024 * 1024,
    mimeWhitelist: new Set(["image/jpeg", "image/png", "image/webp"]),
  },
  POST_INLINE: {
    maxBytes: 5 * 1024 * 1024,
    mimeWhitelist: new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]),
  },
  POST_ATTACHMENT: {
    maxBytes: 20 * 1024 * 1024,
    mimeWhitelist: new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/zip",
      "text/plain",
      "text/csv",
      "text/markdown",
      "application/json",
    ]),
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_CONSTRAINTS;
