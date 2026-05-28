# BLOG — Next.js 15 / React 19 학습 프로젝트

> Next.js 15 App Router · React 19 · tRPC v11 · Drizzle ORM · PostgreSQL · MinIO · JWT 회전 인증 등
> **최신 풀스택 패턴들이 서로 어떻게 맞물려 돌아가는지** 손에 익히는 것을 목표로 한 학습용 블로그.

산출물은 "블로그 서비스" 보다 "학습 자산" 에 가깝다. 모든 핵심 로직에는 **한국어 주석**이 달려 있어
공식 문서로는 채우기 어려운 "왜 이 자리에 이 패턴을 쓰는가" 를 읽으며 배울 수 있도록 구성했다.

---

## 1. 무엇을 배울 수 있는가

- **App Router** 하의 Server Components / Client Components 경계 설계
- **Server Actions** ↔ **tRPC mutation** 의 역할 분리 (폼은 Action, 클라이언트 상호작용은 tRPC)
- **JWT (access + refresh) httpOnly Cookie** 기반 인증과 **토큰 회전(rotation)** + 재사용 감지
- **Drizzle ORM** 스키마 → 마이그레이션 → 쿼리 → 트랜잭션
- **tRPC v11 + TanStack Query v5** prefetch / Hydration
- **React 19 신훅**: `useOptimistic`, `useActionState`, `useFormStatus`
- **Suspense + Streaming SSR** + `loading.tsx`
- **View Transitions API** (Next 15 `next/view-transition`)
- **MinIO Presigned URL** 직접 업로드 (S3 호환 패턴)
- **Tiptap 에디터** 의 이미지/파일 노드 + presigned 업로드 통합
- **Docker** 개발(핫리로드) / 프로덕션(멀티 stage standalone) 두 가지 구성
- **next-themes** 다크모드 + **next-intl** 한/영 i18n
- **PostgreSQL Full-text Search**
- **argon2id 비밀번호 해싱** 등 기본 보안 패턴
- **Vitest** 단위 테스트로 서버 로직 검증

---

## 2. 기술 스택

| 영역             | 선택                                                          |
| ---------------- | ------------------------------------------------------------- |
| 프레임워크       | **Next.js 15** (App Router, `output: 'standalone'`)           |
| 언어             | **TypeScript** (strict + `noUncheckedIndexedAccess`)          |
| UI               | **React 19**, **TailwindCSS v4**, **shadcn/ui (radix-ui)**    |
| 에디터           | **Tiptap** (이미지/링크/플레이스홀더 확장)                    |
| ORM / DB         | **Drizzle ORM** + **PostgreSQL 16**                           |
| API              | **tRPC v11** (일부 mutation 은 Server Actions 와 병행)        |
| 클라이언트 캐시  | **TanStack Query v5** + prefetch / Hydration                  |
| 인증             | **자체 JWT** (`jose`) + httpOnly Secure Cookie + 회전         |
| 비밀번호 해싱    | **argon2id** (`@node-rs/argon2`)                              |
| 파일 저장        | **MinIO** (S3 호환) + AWS SDK v3 + presigner                  |
| 메일             | **Mailpit** (개발 SMTP) + **React Email** + **nodemailer**    |
| i18n / 테마      | **next-intl** (ko/en), **next-themes**                        |
| 검증             | **zod** (입력 + 환경변수)                                     |
| 테스트           | **Vitest**                                                    |
| 컨테이너         | **Docker Compose** (`compose.dev.yml` / `compose.prod.yml`)   |
| 패키지 매니저    | **pnpm**                                                      |

---

## 3. 빠른 시작 (Docker)

> 호스트에 별도로 Node·PostgreSQL·MinIO 를 설치하지 않아도 된다.
> Docker Desktop 만 있으면 충분하다.

```bash
# 1) 환경변수 파일 준비
cp .env.example .env   # JWT 시크릿 등 필요 시 수정

# 2) 개발 스택 기동 (Next + Postgres + MinIO + Mailpit)
docker compose -f compose.dev.yml up --build
```

기동 후 접속 위치:

| URL                       | 용도                          |
| ------------------------- | ----------------------------- |
| http://localhost:3000     | 앱                            |
| http://localhost:8025     | Mailpit (수신 메일함)         |
| http://localhost:9001     | MinIO 콘솔 (`minioadmin/minioadmin`) |
| http://localhost:4983     | Drizzle Studio (옵션, 아래)   |

Drizzle Studio 까지 함께 띄우려면:

```bash
docker compose -f compose.dev.yml --profile tools up drizzle-studio
```

호스트에서 `.tsx` 파일을 수정하면 컨테이너 내 Next dev 가 즉시 반영된다
(Windows bind mount 환경을 위해 `WATCHPACK_POLLING=true` 설정 적용됨).

---

## 4. 자주 쓰는 스크립트

```bash
pnpm dev              # 로컬 직접 실행 (Docker 없이)
pnpm dev:turbo        # Turbopack 모드
pnpm build            # 프로덕션 빌드 (standalone)
pnpm start            # 프로덕션 서버 기동
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest 단위 테스트

# DB
pnpm db:generate      # 스키마 변경 → SQL 마이그레이션 파일 생성
pnpm db:migrate       # drizzle-kit migrate
pnpm db:migrate:run   # 앱 컨테이너에서 마이그레이션 실행
pnpm db:reset         # blog DB 드롭/재생성 (주의)
pnpm db:studio        # Drizzle Studio

# 시드
pnpm seed:categories  # 기본 카테고리(일반/학습/회고) 삽입
pnpm seed:admin       # SEED_ADMIN_EMAIL/PASSWORD 로 ADMIN 계정 생성
```

DB 마이그레이션은 보통 컨테이너 안에서 실행한다:

```bash
docker compose -f compose.dev.yml exec app pnpm db:migrate
```

---

## 5. 환경변수

`.env.example` 을 그대로 복사해서 시작하면 된다. 모든 값은 부팅 시점에
`src/lib/env.ts` 의 zod 스키마로 검증되어, 누락되면 즉시 실패한다.

| 키                                | 설명                                                |
| --------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`             | 앱 외부 노출 URL                                    |
| `DATABASE_URL`                    | Postgres 접속 문자열                                |
| `JWT_ACCESS_SECRET` / `_REFRESH_` | 32자 이상 랜덤 시크릿                               |
| `JWT_ACCESS_TTL`                  | access 만료(초), 기본 900 (15분)                    |
| `JWT_REFRESH_TTL`                 | refresh 만료(초), 기본 2592000 (30일)               |
| `S3_ENDPOINT` / `_PUBLIC_URL`     | MinIO 내부/외부 URL                                 |
| `S3_BUCKET` / `_ACCESS_KEY` / `_SECRET_KEY` | MinIO 자격증명                            |
| `SMTP_HOST` / `_PORT` / `_FROM`   | Mailpit (개발)                                      |
| `DEFAULT_LOCALE` / `SUPPORTED_LOCALES` | i18n 설정                                      |

---

## 6. 디렉터리 구조

```
nextjs-tutorial/
├─ docs/
│  ├─ PRD.md                   # 제품/학습 요구사항 (출처 문서)
│  ├─ IMPLEMENTATION_PLAN.md   # 10개 마일스톤 전체 로드맵
│  └─ plans/                   # 마일스톤별 상세 sub-plan (M1~M10)
├─ compose.dev.yml             # 개발 — Next + Postgres + MinIO + Mailpit
├─ compose.prod.yml            # 프로덕션 — standalone 이미지 검증
├─ Dockerfile.dev              # 개발용 (bind mount)
├─ Dockerfile.prod             # 프로덕션 (multi-stage standalone)
├─ drizzle.config.ts
├─ next.config.ts              # output: 'standalone' + MinIO 이미지 호스트
├─ src/
│  ├─ app/
│  │  ├─ [locale]/             # next-intl 라우트
│  │  │  ├─ (auth)/            # sign-in / sign-up / verify-email / ...
│  │  │  ├─ (main)/            # 피드 / 글 상세·작성 / 프로필 / ...
│  │  │  └─ (admin)/           # ADMIN 전용
│  │  └─ api/
│  │     ├─ trpc/[trpc]/       # tRPC fetch 어댑터
│  │     └─ auth/refresh/      # refresh 회전 Route Handler
│  ├─ server/
│  │  ├─ db/
│  │  │  ├─ schema/            # 도메인별 Drizzle 스키마
│  │  │  └─ migrations/        # drizzle-kit 산출물 (커밋 대상)
│  │  ├─ trpc/                 # initTRPC, context, routers/*
│  │  ├─ auth/                 # jwt, password(argon2), session, cookies
│  │  ├─ storage/              # MinIO S3 client + presign
│  │  ├─ mail/                 # nodemailer + React Email 템플릿
│  │  └─ actions/              # Server Actions
│  ├─ components/              # ui (shadcn) / editor (Tiptap) / ...
│  ├─ hooks/
│  ├─ lib/                     # env, trpc-client, utils
│  ├─ i18n/                    # next-intl 설정·메시지
│  └─ styles/globals.css
└─ tests/                      # Vitest 스펙
```

---

## 7. 아키텍처 한눈에

- **데이터 조회** — RSC 안에서 직접 호출하거나, `createServerSideHelpers` 로
  prefetch → `HydrationBoundary` 로 클라이언트에 전달.
- **폼 제출 (`<form action={...}>`)** — Server Actions + `useActionState` / `useFormStatus`.
- **클라이언트 상호작용 (좋아요/북마크/댓글 토글)** — tRPC mutation + `useOptimistic`.
- **캐시 무효화** — `revalidatePath` / `revalidateTag` 를 액션 안에서 호출.

인증은 access(15분) + refresh(30일) 두 개의 httpOnly Secure 쿠키로 분리되어 있고,
`/api/auth/refresh` 에서 **회전**될 때마다 `sessions.refresh_token_hash` 가 교체된다.
동일 refresh 가 두 번 사용되면 재사용 공격으로 간주해 해당 유저의 모든 세션을 한 번에 revoke 한다.

파일 업로드는 항상 **Presigned PUT** 방식이다. 브라우저가 tRPC 로
`requestUpload` 호출 → 받은 URL 로 MinIO 에 **직접** PUT → 성공 후
`confirmUpload` 로 `attachments` row 와 본문 노드(또는 `users.avatar_key`) 를 갱신한다.

---

## 8. 학습 로드맵 (10개 마일스톤)

자세한 체크리스트는 [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md),
각 마일스톤별 sub-plan 은 [`docs/plans/`](./docs/plans/) 에 있다.

| #   | 마일스톤                  | 핵심 학습 토픽                                            |
| --- | ------------------------- | --------------------------------------------------------- |
| 1   | 부트스트랩                | Next 15 + Tailwind v4 + tRPC + Docker 핫리로드            |
| 2   | DB 스키마 v1              | Drizzle 스키마/마이그레이션, citext, enum                 |
| 3   | 인증                      | argon2 + jose, JWT 회전, `useActionState`, React Email    |
| 4   | 프로필 + Presigned 업로드 | MinIO Presigned PUT, attachments 모델                     |
| 5   | 글 도메인                 | RSC fetch, Tiptap 커스텀 노드, `revalidatePath`           |
| 6   | 상호작용                  | `useOptimistic` 3종 (댓글/좋아요/북마크)                  |
| 7   | 탐색                      | PG Full-text Search, keyset pagination, 무한 스크롤       |
| 8   | 관리자                    | RBAC, `requireAdmin` 미들웨어                             |
| 9   | 마감                      | View Transitions, next-themes, next-intl                  |
| 10  | 테스트 & 프로덕션 Docker  | Vitest, multi-stage Docker, standalone 검증               |

---

## 9. 검증 시나리오 (개발 환경)

1. 회원가입 → Mailpit (http://localhost:8025) 에서 인증 메일 클릭 → `email_verified_at` 갱신.
2. 로그인 → DevTools 에 access / refresh 쿠키 두 개 발급 확인.
3. 프로필 페이지에서 아바타 업로드 → MinIO 콘솔에서 객체 확인.
4. Tiptap 에디터로 글 작성 (인라인 이미지 1장 + 첨부 1개).
5. 다른 계정으로 댓글/좋아요/북마크 → `useOptimistic` 즉시 반영 확인.
6. 검색어 입력 → PG Full-text Search 매칭.
7. 메인 피드에서 무한 스크롤 동작.
8. ADMIN 계정으로 글 숨김 / 유저 비활성화.

프로덕션 이미지(standalone) 빌드 검증:

```bash
docker compose -f compose.prod.yml up --build
```

단위 테스트:

```bash
pnpm test
```

---

## 10. 보안 / 비기능 요구사항 (요약)

- **XSS** — Tiptap 출력은 허용 노드 화이트리스트로 sanitize.
- **CSRF** — SameSite=Lax 쿠키 + Origin 검증.
- **SQL Injection** — Drizzle 의 파라미터 쿼리.
- **비밀번호** — argon2id (`@node-rs/argon2`).
- **환경변수** — zod 로 부팅 시점에 강제 검증.
- **TypeScript** — strict + `noUncheckedIndexedAccess`.
- **마이그레이션** — `drizzle-kit generate` 로 생성된 SQL 파일만 신뢰, 커밋 대상.
- **프로덕션 이미지** — 비루트 사용자, multi-stage 로 dev deps 제거.

---

## 11. 비목표 (Non-Goals)

- 프로덕션 배포 자동화(CI/CD, Kubernetes 등)
- E2E 테스트(Playwright) — 1차 범위에서 제외
- 결제 / 푸시 / 분석 등 부가 SaaS 기능
- PWA / 오프라인 캐시
- 다중 테넌시(Workspace) 모델

---

## 12. 라이선스 / 참고

학습용 개인 프로젝트. 외부 배포를 가정하지 않는다.
설계 의도와 의사결정의 배경은 [`docs/PRD.md`](./docs/PRD.md) 와 각 마일스톤
sub-plan 의 주석에서 확인할 수 있다.
