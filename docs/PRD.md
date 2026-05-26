# Next.js 학습용 블로그 PRD

> **문서 목적**: Next.js 15+ / React 19 의 최신 패턴을 실제 동작하는 블로그 서비스를 만들며 학습하기 위한 제품 요구사항 문서(PRD).
> 이 문서는 곧이어 작성할 **구현 계획(implementation plan)** 의 기준이 된다.

---

## 1. 배경 · 목표

### 1.1 배경
- Next.js 공식 문서(https://nextjs.org/docs)를 따라가는 것만으로는 React 19 / App Router / Server Actions / 캐시·프리패칭 · tRPC · Drizzle · Docker · JWT 같은 **여러 최신 기술의 상호작용**을 충분히 체득하기 어렵다.
- 학습자가 "내가 직접 만들어 본 블로그" 를 통해 각 기술이 어떤 자리에서 어떤 트레이드오프로 동작하는지 손에 익히는 것이 목표다.

### 1.2 학습 목표 (이 프로젝트의 진짜 산출물)
이 프로젝트는 "블로그" 보다 "학습 자산" 이 산출물이다. 다음을 직접 만지고 코드 주석으로 설명할 수 있어야 한다.

1. **App Router** 하의 Server Components / Client Components 경계 설계
2. **Server Actions** 와 tRPC mutation 의 역할 분리
3. **JWT(access + refresh) httpOnly Cookie** 기반 인증과 토큰 회전(rotation)
4. **Drizzle ORM** 스키마 → 마이그레이션 → 쿼리 → 트랜잭션
5. **tRPC v11** + **TanStack Query v5** prefetch / hydration
6. **React 19 신훅**: `useOptimistic`, `useActionState`, `useFormStatus`
7. **Suspense + Streaming SSR** + `loading.tsx`
8. **View Transitions API** (Next 15 `next/view-transition`)
9. **MinIO Presigned URL** 직접 업로드 (S3 호환 패턴)
10. **Tiptap 에디터** 에서 이미지/파일 노드 + presigned 업로드 통합
11. **Docker** 개발(핫리로드) / 프로덕션(멀티 stage standalone) 두 가지 구성
12. **next-themes** 다크모드 + **next-intl** 한/영 i18n
13. **PostgreSQL Full-text Search**
14. **bcrypt/argon2 비밀번호 해싱** 등 기본 보안 패턴
15. **Vitest** 단위 테스트로 서버 로직 검증

### 1.3 비목표 (Non-Goals)
- 프로덕션 배포 자동화(CI/CD, Kubernetes 등) — 학습 범위 밖.
- E2E 테스트(Playwright) — 1차 범위에서 제외.
- 결제, 알림, 푸시, 분석 등 부가 SaaS 기능.
- PWA, 오프라인 캐시.
- 다중 테넌시, 조직(Workspace) 모델.

### 1.4 페르소나
- **단일 페르소나**: Next.js 14 정도까지 사용해 본 적이 있고 React 19 / App Router / Drizzle / tRPC 를 **본격 학습**하려는 한국어 사용 개발자(학습자 본인).

---

## 2. 기술 스택 (확정)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js 15+** (App Router) | `output: 'standalone'` 사용 |
| 언어 | **TypeScript** (strict) | `noUncheckedIndexedAccess` 켬 |
| UI 라이브러리 | **React 19** | RSC, 신훅 적극 사용 |
| 스타일 | **TailwindCSS v4** + **shadcn/ui** | `next-themes` 로 다크모드 |
| 에디터 | **Tiptap** | 이미지/파일 커스텀 노드 |
| ORM | **Drizzle ORM** | `drizzle-kit` 으로 마이그레이션 |
| DB | **PostgreSQL 16** | Full-text Search 활용 |
| API 레이어 | **tRPC v11** | 일부 mutation 은 Server Actions 와 병행 |
| 클라이언트 캐시 | **TanStack Query v5** | tRPC 통합, prefetch + Hydration |
| 인증 | **자체 JWT** (access + refresh) | `jose` 사용, httpOnly Secure Cookie |
| 비번 해싱 | **argon2** (`@node-rs/argon2`) | bcrypt 대비 권장 |
| 파일 저장 | **MinIO** (S3 호환) | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| 메일 | **Mailpit** (개발용 SMTP) + **React Email** + **nodemailer** | 이메일 인증·재설정 |
| i18n | **next-intl** | 한국어/영어 |
| 검증 | **zod** | 모든 입력, 환경변수 |
| 테스트 | **Vitest** | 서버/유틸 단위 테스트 |
| 컨테이너 | **Docker Compose** | `compose.dev.yml`, `compose.prod.yml` 분리 |
| 패키지 매니저 | **pnpm** | 빠르고 모노레포 대응 용이 |

---

## 3. 기능 요구사항 (FR)

### 3.1 인증 / 계정
- **FR-AUTH-1** 이메일 + 비밀번호 회원가입
- **FR-AUTH-2** 이메일 인증 메일 발송 → 토큰 클릭 시 활성화 (Mailpit 으로 수신 확인)
- **FR-AUTH-3** 로그인 → access(JWT, 15분) + refresh(JWT, 30일) 발급, 둘 다 httpOnly Secure Cookie 저장
- **FR-AUTH-4** access 만료 시 `/api/auth/refresh` 호출 → refresh 검증 → **회전(rotate)** 후 새 access/refresh 발급
- **FR-AUTH-5** 로그아웃 → 서버에서 현재 세션 무효화 + 쿠키 제거
- **FR-AUTH-6** 비밀번호 재설정 메일 → 토큰 기반 재설정
- **FR-AUTH-7** 비밀번호 변경 (로그인 상태에서 현재 비번 검증 후 변경)

### 3.2 프로필
- **FR-PROF-1** 닉네임 · 한 줄 소개 수정
- **FR-PROF-2** 아바타 이미지 업로드 (Presigned PUT, 최대 2MB, jpg/png/webp)
- **FR-PROF-3** 내가 쓴 글 · 북마크한 글 목록

### 3.3 글
- **FR-POST-1** 글 작성 (제목, Tiptap 본문 JSON, 카테고리 1개, 태그 N개, 공개 여부)
- **FR-POST-2** 본문에 이미지/파일 삽입 → Presigned 업로드 후 노드에 URL 저장
- **FR-POST-3** 첨부 파일 다운로드 영역 (본문과 별도)
- **FR-POST-4** 글 수정 / 삭제 (작성자 or ADMIN 만)
- **FR-POST-5** 글 상세 페이지 — 본문은 즉시, 댓글은 Suspense streaming 으로 후행
- **FR-POST-6** 글 목록 (최신순) — 무한 스크롤 (`useInfiniteQuery` + Suspense)
- **FR-POST-7** 카테고리/태그 필터링
- **FR-POST-8** PostgreSQL Full-text Search 로 제목/본문 검색

### 3.4 상호작용 (모두 `useOptimistic` 활용)
- **FR-INT-1** 댓글 (대댓글 1단계까지)
- **FR-INT-2** 좋아요 (토글)
- **FR-INT-3** 북마크 (토글)

### 3.5 관리자 (ROLE = ADMIN)
- **FR-ADM-1** 유저 목록 / 검색 / 비활성화
- **FR-ADM-2** 글 목록 / 숨김 / 삭제

### 3.6 i18n / 테마
- **FR-I18N-1** 한국어 / 영어 라우트(`/[locale]/...`)
- **FR-I18N-2** 라이트 / 다크 / 시스템 테마 토글

---

## 4. 비기능 요구사항 (NFR)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-1 | 보안 | XSS 방지(Tiptap 출력 sanitize), CSRF 방지(SameSite=Lax + Origin 검증), SQL Injection 방지(Drizzle 파라미터 쿼리), 비밀번호 argon2id |
| NFR-2 | 환경변수 | `zod` 로 부팅 시 검증, 누락 시 즉시 실패 |
| NFR-3 | 코드 가독성 | **모든 핵심 로직에 한국어 주석** (학습용 필수) |
| NFR-4 | 타입 | TypeScript strict + `noUncheckedIndexedAccess` |
| NFR-5 | 로깅 | 개발은 `console`, 서버 액션·tRPC 에러는 구조화 로깅(JSON) |
| NFR-6 | 마이그레이션 | `drizzle-kit generate` → 커밋된 SQL 파일만 신뢰 |
| NFR-7 | 컨테이너 보안 | 프로덕션 이미지는 비루트 사용자, 멀티 stage 로 dev deps 제거 |

---

## 5. 데이터 모델 (Drizzle 스키마 개요)

> 마이그레이션은 `drizzle-kit` 으로 SQL 파일을 생성·커밋한다. 아래는 논리 스키마.

### 5.1 테이블

#### users
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| email | text UNIQUE NOT NULL | citext 형태로 소문자 정규화 |
| password_hash | text NOT NULL | argon2id |
| nickname | text NOT NULL | |
| bio | text | 한 줄 소개 |
| avatar_key | text | MinIO 객체 키 |
| role | enum('USER','ADMIN') NOT NULL DEFAULT 'USER' | |
| email_verified_at | timestamptz | NULL 이면 미인증 |
| is_active | boolean NOT NULL DEFAULT true | 관리자 비활성화용 |
| created_at / updated_at | timestamptz | |

#### sessions (refresh 토큰 회전 추적)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | refresh JWT 의 `jti` 와 동일 |
| user_id | uuid FK users.id ON DELETE CASCADE | |
| refresh_token_hash | text NOT NULL | refresh 평문은 절대 저장 X (SHA-256 해시) |
| user_agent | text | |
| ip | inet | |
| expires_at | timestamptz NOT NULL | |
| revoked_at | timestamptz | 회전·로그아웃 시 |
| replaced_by | uuid | 회전 후 새 세션 id |
| created_at | timestamptz | |

#### email_verifications, password_resets
- `id`, `user_id`, `token_hash`, `expires_at`, `used_at`

#### categories
- `id`(uuid), `slug`(unique), `name`

#### tags
- `id`(uuid), `slug`(unique), `name`

#### posts
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| author_id | uuid FK users.id | |
| category_id | uuid FK categories.id NULL | |
| title | text NOT NULL | |
| slug | text UNIQUE NOT NULL | |
| content_json | jsonb NOT NULL | Tiptap JSON |
| content_text | text NOT NULL | 검색용 plain text (트리거 또는 앱에서 생성) |
| is_published | boolean NOT NULL DEFAULT true | |
| is_hidden | boolean NOT NULL DEFAULT false | 관리자 숨김 |
| search_tsv | tsvector | GENERATED ALWAYS (title || content_text) |
| created_at / updated_at | timestamptz | |

- 인덱스: `GIN(search_tsv)`, `(created_at desc)`

#### post_tags
- `post_id`, `tag_id` 복합 PK

#### attachments (게시글 첨부)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK posts.id ON DELETE CASCADE NULL | NULL = 본문 인라인 |
| owner_id | uuid FK users.id | |
| object_key | text NOT NULL | MinIO 키 |
| original_name | text NOT NULL | |
| mime_type | text NOT NULL | |
| size_bytes | bigint NOT NULL | |
| kind | enum('AVATAR','POST_INLINE','POST_ATTACHMENT') | |
| created_at | timestamptz | |

#### comments
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK posts.id ON DELETE CASCADE | |
| author_id | uuid FK users.id | |
| parent_id | uuid FK comments.id NULL | 대댓글 1단계만 허용 (앱 검증) |
| content | text NOT NULL | |
| created_at / updated_at | timestamptz | |

#### likes, bookmarks
- `(user_id, post_id)` 복합 PK, `created_at`

---

## 6. API 설계 (tRPC 라우터 + Server Actions)

### 6.1 라우터 분리
- `auth` — `signUp`, `signIn`, `signOut`, `me`, `requestPasswordReset`, `resetPassword`, `verifyEmail`
- `profile` — `update`, `requestAvatarUpload`(presigned)
- `post` — `list`(infinite), `bySlug`, `create`, `update`, `delete`, `search`, `requestAttachmentUpload`
- `comment` — `listByPost`, `create`, `delete`
- `like` — `toggle`
- `bookmark` — `toggle`, `myBookmarks`
- `admin` — `users.list`, `users.setActive`, `posts.list`, `posts.setHidden`

### 6.2 Server Actions 와의 역할 분리 (학습 포인트)
- **폼 제출(`<form action={...}>`)** = Server Action 사용 (로그인, 회원가입, 글 작성 폼) → `useActionState` 와 결합해 진행 상태/에러를 다룬다.
- **클라이언트 상호작용(좋아요/북마크/댓글 토글)** = tRPC mutation + `useOptimistic`.
- **데이터 조회** = RSC 안에서 직접 호출 또는 `queryClient.prefetchQuery` 후 Hydration.

### 6.3 인가
- 모든 protected procedure 는 `ctx.user` 존재 확인.
- ADMIN 전용 procedure 는 `requireAdmin` 미들웨어.

---

## 7. 인증 흐름 상세

### 7.1 토큰
- **access JWT**: payload `{ sub: userId, role }`, exp 15분, 서명 `JWT_ACCESS_SECRET`
- **refresh JWT**: payload `{ sub: userId, jti: sessionId }`, exp 30일, 서명 `JWT_REFRESH_SECRET`
- 둘 다 httpOnly · Secure · SameSite=Lax 쿠키.
- `sessions.refresh_token_hash` = SHA-256(refresh 평문)

### 7.2 시퀀스
```
회원가입 → 이메일 인증 토큰 메일(Mailpit) → 클릭 → email_verified_at 갱신
로그인 → 비번 argon2 검증 → access+refresh 발급, sessions row 생성
요청 → 미들웨어가 access 검증 → 통과
access 만료 → /api/auth/refresh →
  ① refresh 검증
  ② DB sessions 조회 (revoked 아닌지)
  ③ 기존 세션 revoked_at = now, replaced_by = 새 sessionId
  ④ 새 access/refresh 발급
  ⑤ 쿠키 갱신
로그아웃 → 현재 sessionId revoke + 쿠키 삭제
```

### 7.3 미들웨어 (Next.js middleware)
- `/api/trpc/*`, RSC fetch 모두 쿠키 동봉
- 미들웨어에서는 access 의 **서명만** 검증(가벼움)
- 실제 권한/사용자 로딩은 tRPC `createContext` 에서 수행

---

## 8. 파일 업로드 흐름 (Presigned PUT)

```
[브라우저]                                  [Next.js / tRPC]                [MinIO]
  │  ── requestUpload(filename, mime, size) ─►                                │
  │                                              ① 파일 검증(크기/MIME)        │
  │                                              ② object_key 생성             │
  │                                                  (예: posts/2026/05/<uuid>) │
  │                                              ③ Presigned PUT URL 발급      │
  │  ◄── { uploadUrl, objectKey, headers } ──                                  │
  │  ── PUT uploadUrl (Body: 파일) ───────────────────────────────────────────►│
  │  ◄────────────────────────────────────────────────────────── 200 OK ──    │
  │  ── confirmUpload(objectKey, postId?) ──►                                  │
  │                                              ④ attachments row INSERT      │
  │                                              ⑤ Tiptap 노드 또는 프로필 갱신 │
```

- 업로드 종류별 제약
  - AVATAR: 2 MB, jpg/png/webp
  - POST_INLINE: 5 MB, jpg/png/webp/gif
  - POST_ATTACHMENT: 20 MB, 화이트리스트 MIME
- 다운로드는 공개 객체면 직접 URL, 비공개면 presigned GET 발급.

---

## 9. 화면 / 라우트 구조

```
/[locale]
  /(auth)
    /sign-in
    /sign-up
    /verify-email
    /forgot-password
    /reset-password
  /(main)
    /                       # 피드 (무한 스크롤)
    /posts/[slug]           # 글 상세
    /posts/new              # 글 작성
    /posts/[slug]/edit
    /tags/[slug]
    /categories/[slug]
    /search?q=...
    /u/[nickname]           # 프로필
    /me                     # 내 설정
    /me/bookmarks
  /(admin)
    /admin/users
    /admin/posts
```

각 segment 에는 `loading.tsx`, `error.tsx`, 필요한 곳에는 `not-found.tsx` 를 둔다.

---

## 10. Docker 구성

### 10.1 공통 서비스
- `postgres` (16-alpine)
- `minio` + `minio-mc` (버킷 자동 생성)
- `mailpit` (UI 8025, SMTP 1025)

### 10.2 `compose.dev.yml`
- `app` 서비스
  - 베이스 이미지: `node:22-alpine`
  - **bind mount**: 호스트 소스 ↔ `/app`
  - 명령: `pnpm dev` (Turbopack)
  - 환경: `WATCHPACK_POLLING=true`, `CHOKIDAR_USEPOLLING=true` (Windows bind mount 핫리로드 보장)
  - 포트: 3000
- `drizzle-studio` 프로필 선택 시 함께 기동 (별도 서비스)
- depends_on: postgres healthy, minio healthy, mailpit

### 10.3 `compose.prod.yml`
- `app` 서비스
  - 멀티 stage `Dockerfile.prod`
    1. `deps`: `pnpm install --frozen-lockfile`
    2. `builder`: 소스 복사 → `pnpm build` (`output: 'standalone'`)
    3. `runner`: `node:22-alpine`, 비루트 사용자, `.next/standalone` + `.next/static` + `public` 복사
  - `CMD ["node", "server.js"]`
  - 포트: 3000
- postgres / minio / mailpit 동일하게 포함 (학습용)

### 10.4 Dockerfile 핵심 포인트
- `.dockerignore` 로 `node_modules`, `.next`, `.git` 제외
- 빌드 시 `NEXT_TELEMETRY_DISABLED=1`
- `HEALTHCHECK` 로 `/api/health` 확인

---

## 11. 디렉터리 구조 (제안)

```
nextjs-tutorial/
├─ docs/
│  └─ PRD.md
├─ compose.dev.yml
├─ compose.prod.yml
├─ Dockerfile.dev
├─ Dockerfile.prod
├─ drizzle.config.ts
├─ next.config.ts
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ (auth)/...
│  │  │  ├─ (main)/...
│  │  │  └─ (admin)/...
│  │  ├─ api/
│  │  │  ├─ trpc/[trpc]/route.ts
│  │  │  └─ auth/refresh/route.ts
│  │  └─ layout.tsx
│  ├─ server/
│  │  ├─ db/
│  │  │  ├─ schema/                # 도메인별 스키마 파일
│  │  │  ├─ migrations/            # drizzle-kit 산출물
│  │  │  └─ client.ts
│  │  ├─ trpc/
│  │  │  ├─ trpc.ts                # initTRPC, middlewares
│  │  │  ├─ context.ts
│  │  │  └─ routers/
│  │  ├─ auth/
│  │  │  ├─ jwt.ts                 # jose 발급/검증
│  │  │  ├─ password.ts            # argon2
│  │  │  ├─ session.ts             # 회전 로직
│  │  │  └─ cookies.ts
│  │  ├─ storage/
│  │  │  ├─ s3.ts                  # MinIO S3 client
│  │  │  └─ presign.ts
│  │  ├─ mail/
│  │  │  ├─ transport.ts           # nodemailer + Mailpit
│  │  │  └─ templates/             # React Email
│  │  └─ actions/                  # Server Actions
│  ├─ components/
│  │  ├─ ui/                       # shadcn
│  │  ├─ editor/                   # Tiptap 래퍼
│  │  └─ ...
│  ├─ hooks/
│  ├─ lib/
│  │  ├─ env.ts                    # zod 환경변수 검증
│  │  ├─ trpc-client.ts            # client 측 tRPC
│  │  └─ utils.ts
│  ├─ i18n/
│  │  ├─ config.ts
│  │  └─ messages/{ko,en}.json
│  └─ styles/globals.css
└─ tests/
   └─ ...vitest specs
```

---

## 12. React 19 / Next 15 학습 토픽 매핑

| 토픽 | 적용 위치 |
|---|---|
| Server Component 데이터 fetching | 피드 페이지(`/`), 글 상세(`/posts/[slug]`) |
| Server Actions + `useActionState` + `useFormStatus` | 로그인/회원가입/글 작성 폼 |
| `useOptimistic` | 댓글 작성, 좋아요 토글, 북마크 토글 |
| Suspense + Streaming + `loading.tsx` | 글 상세에서 본문은 즉시, 댓글 섹션은 Suspense |
| `<form action={serverAction}>` 표준 폼 | 모든 입력 폼 |
| Server Component → Client Component props 직렬화 경계 | 에디터/상호작용 컴포넌트 분리 |
| View Transitions API (`unstable_ViewTransition`) | 글 목록 → 상세 전환 |
| TanStack Query prefetch + dehydrate/hydrate | 검색·무한 스크롤 페이지 초기 데이터 |
| `revalidatePath` / `revalidateTag` | 글 작성/수정/삭제 후 캐시 무효화 |
| Route Handler vs Server Action 차이 | `/api/auth/refresh` (Route) vs `signIn` (Action) |

---

## 13. 학습 마일스톤 (구현 순서)

> 한 마일스톤 = 한 PR 단위로 작업 권장.

1. **부트스트랩**: `create-next-app` + Tailwind v4 + shadcn + Drizzle + tRPC + zod + i18n + Docker(dev) 스켈레톤
2. **DB 스키마 v1**: users, sessions, email_verifications, password_resets + `drizzle-kit` 마이그레이션
3. **인증**: argon2, jose, 쿠키, 회전 로직 + 회원가입/로그인/로그아웃/리프레시 + Mailpit 인증 메일 (`useActionState` 적용)
4. **프로필 + MinIO Presigned**: 아바타 업로드 풀 흐름
5. **글 도메인**: posts/categories/tags/attachments 스키마 + Tiptap 에디터 + 인라인 이미지 presigned + 글 CRUD
6. **상호작용**: 댓글/좋아요/북마크 + `useOptimistic` 3종 적용
7. **탐색**: PG Full-text Search + 태그/카테고리 필터 + `useInfiniteQuery` 무한 스크롤 + Suspense
8. **관리자**: ADMIN 라우트, 유저/글 관리
9. **마감**: View Transitions, 다크모드, i18n 메시지 완비
10. **테스트 & 프로덕션 Docker**: Vitest 단위 테스트, `compose.prod.yml` + `Dockerfile.prod` 빌드/실행 검증

각 마일스톤 종료 조건은 별도 구현 계획(implementation plan)에서 체크리스트화한다.

---

## 14. 환경변수 (`.env` 키 목록)

```
# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# DB
DATABASE_URL=postgres://postgres:postgres@postgres:5432/blog

# JWT
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=900             # 15분
JWT_REFRESH_TTL=2592000        # 30일

# MinIO
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=blog
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_PUBLIC_URL=http://localhost:9000   # 브라우저가 접근할 URL

# Mail
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM="Blog <no-reply@blog.local>"

# i18n
DEFAULT_LOCALE=ko
SUPPORTED_LOCALES=ko,en
```

모든 값은 `src/lib/env.ts` 에서 `zod` 로 검증한다.

---

## 15. 시드 / 초기 데이터

- 첫 부팅 시 ADMIN 계정 1개 생성 (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` 가 있을 때만)
- 카테고리 기본값: `일반`, `학습`, `회고`
- 태그는 시드 없음 (사용자 생성)

---

## 16. 검증 방법

### 16.1 로컬(개발)
```bash
docker compose -f compose.dev.yml up --build
```
- http://localhost:3000 접속, 핫리로드 동작 확인
- http://localhost:8025 (Mailpit) 에서 인증 메일 수신
- http://localhost:9001 (MinIO Console) 에서 업로드된 객체 확인

시나리오:
1. 회원가입 → Mailpit 메일 클릭 → 이메일 인증
2. 로그인 → 쿠키 두 개(access/refresh) 발급 확인 (DevTools)
3. 프로필 아바타 업로드
4. 글 작성 (Tiptap, 이미지 1장 + 첨부 1개)
5. 다른 계정으로 로그인 → 댓글/좋아요/북마크 (`useOptimistic` 즉시 반영 확인)
6. 검색어 입력 → 결과 노출
7. 무한 스크롤 동작
8. ADMIN 계정으로 글 숨김 / 유저 비활성화

### 16.2 프로덕션 이미지
```bash
docker compose -f compose.prod.yml up --build
```
- 동일 시나리오가 standalone 빌드에서 동작
- 이미지 크기 < 300MB 목표

### 16.3 단위 테스트
```bash
pnpm test
```
- `auth/jwt` 발급/검증
- `auth/session` 회전 로직(만료, 재사용 거부)
- `storage/presign` 키 생성 규칙
- `server/trpc/routers/*` 핵심 procedure (mock context)

---

## 17. 리스크 / 주의

| 리스크 | 대응 |
|---|---|
| Windows bind mount 핫리로드 누락 | `WATCHPACK_POLLING=true` 설정 |
| Tiptap JSON XSS | 서버에서 허용 노드 화이트리스트로 sanitize |
| refresh 토큰 재사용 공격 | 회전 시 `replaced_by` 추적, 재사용 감지되면 user 전체 세션 revoke |
| MinIO presigned URL 노출 | 단기 TTL(5분), 업로드 후 confirm 호출 안 하면 GC |
| tRPC + Server Action 역할 모호 | 본 PRD 6.2 규칙을 README 에도 명시 |

---

## 18. 향후(2차) 후보
- E2E 테스트(Playwright)
- 댓글 다단계 / 멘션
- 알림 (in-app)
- 태그 검색 자동완성
- Edge runtime 으로 일부 라우트 이동 비교
- PPR 도입 실험

---

문서 끝.
