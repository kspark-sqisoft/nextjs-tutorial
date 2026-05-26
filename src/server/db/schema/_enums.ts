// 도메인 공용 enum 정의 파일.
// 학습 포인트: Drizzle 의 pgEnum 은 단일 정의 → 모든 테이블에서 재사용.
// enum 값 변경 시 새 마이그레이션이 필요하다(추가는 쉬움, 제거/이름변경은 까다로움).
import { pgEnum } from "drizzle-orm/pg-core";

// 사용자 권한 enum — M3 의 JWT 페이로드, M8 의 admin 가드에서 사용.
export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);

// 첨부 파일 종류 — M4(아바타), M5(글 본문 인라인/별도 첨부)에서 사용.
export const attachmentKindEnum = pgEnum("attachment_kind", [
  "AVATAR",
  "POST_INLINE",
  "POST_ATTACHMENT",
]);
