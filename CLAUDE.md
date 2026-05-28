# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 프로젝트는 무엇인가

Next.js 15 / React 19 의 최신 풀스택 패턴을 **학습용 블로그를 만들며** 손에 익히기 위한 모놀리식 프로젝트. 산출물은 "블로그"가 아니라 "학습 자산"이라는 전제가 NFR로 박혀 있다. 자세한 배경·로드맵은 `docs/PRD.md` 와 `docs/IMPLEMENTATION_PLAN.md` (10개 마일스톤). 사용자 가이드는 `README.md`.

## 기본 명령

개발은 **Docker Compose 안에서 돌리는 게 표준 경로**다. 호스트에서 직접 `pnpm dev` 도 되지만 그 경우 Postgres/MinIO/Mailpit 를 따로 띄워야 한다.

```bash
# 개발 스택 전체 기동 (app + postgres + minio + mailpit)
docker compose -f compose.dev.yml up --build
docker compose -f compose.dev.yml up -d app      # .env 만 바꾼 뒤 app 만 재생성
docker compose -f compose.dev.yml restart app    # next.config.ts 변경 후 재시작

# DB 마이그레이션은 컨테이너 안에서
docker compose -f compose.dev.yml exec app pnpm db:generate
docker compose -f compose.dev.yml exec app pnpm db:migrate

# Drizzle Studio (옵션 프로필)
docker compose -f compose.dev.yml --profile tools up drizzle-studio   # :4983
```

호스트에서 직접:

```bash
pnpm typecheck             # tsc --noEmit
pnpm lint                  # next lint
pnpm test                  # vitest run (단일 파일: pnpm test path/to/file.test.ts)
pnpm seed:categories       # 기본 카테고리 시드
pnpm seed:admin            # SEED_ADMIN_EMAIL/PASSWORD 로 ADMIN 계정 생성
pnpm db:reset              # blog DB 드롭/재생성 (주의)
```

테스트는 호스트에서 `TEST_DATABASE_URL=postgres://...@localhost:5432/blog_test` 를 사용한다 — dev DB(`blog`)와 반드시 분리.

## 아키텍처 — "빅픽처"

### 데이터 흐름의 3가지 모드 (역할이 엄격히 분리됨)

| 모드 | 사용처 | 패턴 |
|---|---|---|
| **Server Actions** | 폼 제출 (로그인/회원가입/글 작성) | `<form action={serverAction}>` + `useActionState` + `useFormStatus` |
| **tRPC mutation** | 클라이언트 상호작용 토글 (좋아요/북마크/댓글) | `useOptimistic` + `trpc.x.useMutation` |
| **RSC fetch / prefetch + Hydration** | 데이터 조회 | RSC에서 `getTrpcHelpers()` → `prefetchInfinite` → `<HydrationBoundary state={dehydrate(...)}>` → 클라이언트 `useInfiniteQuery` 가 그대로 이어감 |

새 기능을 추가할 때 어느 모드에 속하는지 먼저 결정한다. 잘못 섞으면 캐시 무효화·에러 처리·낙관적 업데이트가 모두 어색해진다.

### tRPC 미들웨어 3티어 (`src/server/trpc/trpc.ts`)
- `publicProcedure` — 누구나
- `protectedProcedure` — `ctx.user` 필요 (없으면 `UNAUTHORIZED`)
- `adminProcedure` — `ctx.user.role === 'ADMIN'` (없으면 `FORBIDDEN`)

`createContext`는 access JWT 쿠키를 검증해 `ctx.user`를 채운다. `getCurrentUser`는 React `cache`로 같은 요청에서 1회만 DB 조회한다.

### 인증 — JWT 회전 + 재사용 감지

- access (15분) + refresh (30일), 둘 다 `httpOnly` `Secure` `SameSite=Lax` 쿠키
- `sessions.refresh_token_hash` = SHA-256(refresh 평문) — 평문은 절대 DB에 저장 안 함
- `/api/auth/refresh` 호출 시 회전: 기존 세션 `revoked_at + replaced_by` 설정 + 새 access/refresh 발급
- **재사용 감지**: revoke된 refresh로 다시 회전 시도하면 해당 user의 **모든 세션을 revoke** (탈취 방어)
- 미들웨어는 access "서명만" 검증 (가볍게). 실제 user 로딩은 tRPC `createContext`에서

### 이미지/파일 URL 정책 — **반드시 숙지**

이 프로젝트의 가장 중요한 함정이다.

**핵심 원칙**: `localhost`는 클라이언트마다 다른 머신을 가리킨다 (PC에선 PC, 모바일에선 모바일). 그래서 **브라우저용 이미지 URL에 절대 호스트를 박지 않는다**.

- `publicUrl(objectKey)` → `/s3/<key>` (상대 경로) 반환
- `normalizeS3Url(src)` → 본문 JSON에 박힌 옛 절대 URL을 `/s3/<key>` 로 정규화
- `next.config.ts`의 `rewrites()`가 `/s3/:path*` → `${S3_ENDPOINT}/${S3_BUCKET}/:path*` 로 프록시
- 그래서 `next/image`의 `remotePatterns`는 비어있어도 된다 (자기 호스트는 자동 허용)

**예외**: presigned **PUT 업로드** URL만은 절대 URL이 필요하다 (서명에 호스트 포함). 그래서 `s3Public` 클라이언트와 `env.S3_PUBLIC_URL` 은 업로드 전용으로 유지한다. 모바일에서도 업로드해야 하면 그때만 `S3_PUBLIC_URL`을 PC LAN IP로 임시 변경.

`src/server/storage/s3.ts` 의 헤더 주석에 두 S3 클라이언트(`s3` 내부 통신용 vs `s3Public` presign 전용)의 차이가 정리돼 있다.

### XSS 방어 (`src/server/posts/sanitize.ts`)
Tiptap JSON → HTML 변환 시 `ALLOWED_NODES` / `ALLOWED_MARKS` 화이트리스트로 필터링한 뒤 `generateHTML` 호출. image 노드의 `attrs.src`는 `normalizeS3Url`로 한 번 더 통과.

### 환경변수 — 부팅 시 zod 강제 검증

`src/lib/env.ts` 가 모든 키를 zod 로 검증한다. 누락/오타 시 **앱이 부팅하지 않는다**. `env.X` 로만 접근하고 `process.env.X` 직접 접근은 (가능하면) 피한다. 단 `next.config.ts` 안에서는 빌드 시점이라 zod env가 없어 `process.env.X ?? "default"` 패턴이 정상.

### Docker dev 의 미묘한 함정들

- **`.next` 가 named volume (`next_cache`)** — 컨테이너 재시작해도 캐시가 영속된다. dev에서 모듈 인스턴스가 분기되어 같은 함수가 두 결과를 내는 등 이상 현상이 보이면 `.next` 비우고 재기동을 의심 (단, 캐시 삭제는 destructive이므로 사용자 승인 필요).
- **Windows bind mount + inotify 누락** — `compose.dev.yml`이 `WATCHPACK_POLLING=true`, `CHOKIDAR_USEPOLLING=true` 설정, `next.config.ts`의 webpack `watchOptions.poll: 1000` 도 함께 적용. 둘 다 필요.
- **`-H 0.0.0.0`** — `pnpm dev`/`start`가 0.0.0.0 바인딩이라 같은 망의 모바일도 `http://<PC IP>:3000` 으로 접속 가능. 이미지 URL이 상대 경로이므로 (위 정책) 모바일에서도 깨지지 않는다.
- **MinIO CORS** — `minio-init` 서비스가 부팅 시 버킷 생성 + 익명 다운로드 허용을 설정한다. 버킷이 없거나 권한 문제로 이미지가 안 보이면 `minio-init` 로그 확인.

### 디렉토리 빠른 가이드 (디테일은 직접 탐색)

- `src/app/[locale]/(auth|main|admin)/` — App Router 라우트 그룹. 모든 사용자 라우트는 locale 세그먼트 안.
- `src/server/db/{schema,migrations}/` — Drizzle. 마이그레이션 SQL은 커밋 대상.
- `src/server/trpc/routers/` — 도메인별 tRPC 라우터. `_app.ts`가 합친다.
- `src/server/auth/` — `jwt.ts` (jose), `password.ts` (argon2id), `session.ts` (회전 + 재사용 감지), `cookies.ts`.
- `src/server/actions/` — Server Actions. 폼 전용.
- `src/server/storage/` — S3 클라이언트 + presign + 화이트리스트(MIME/크기) 검증.

## 코드 규칙

- **모든 핵심 로직에는 한국어 주석** (NFR-3, `docs/PRD.md` §4). 코드 자체뿐 아니라 "이 자리에 왜 이 패턴인가"를 학습자가 읽을 수 있어야 한다.
- TypeScript strict + `noUncheckedIndexedAccess`. 배열 인덱스 결과는 `T | undefined`로 다룬다.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`. 한 마일스톤 = 한 PR이 권장이지만, 마일스톤 내부에서도 도메인 단위로 잘게 쪼개 커밋.
- 폼 입력·tRPC input·환경변수 전부 `zod`로 검증. 입력 검증 우회 금지 (XSS/SQL Injection은 Drizzle 파라미터 쿼리와 sanitize로 자동 방어되지만, 정책은 NFR-1).

## 마일스톤별 sub-plan

각 마일스톤(`docs/IMPLEMENTATION_PLAN.md`)은 본격 진입 시 별도 sub-plan(`docs/plans/M{1..10}-*.md`)을 보고 TDD 단계로 진행한다. M1 부트스트랩만 명령어·파일 내용까지 상세, M2~M10은 작업 항목과 코드 골격 위주.
