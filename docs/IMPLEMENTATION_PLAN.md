# Next.js 학습용 블로그 — 구현 계획 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/PRD.md` 에 정의된 학습용 블로그를 10개의 마일스톤으로 나눠 단계적으로 구현한다. 각 마일스톤은 독립적으로 동작·검증 가능하며, PR 단위로 묶일 수 있다.

**Architecture:** Next.js 15 App Router(React 19) 단일 모놀리식 + tRPC 백엔드 + Drizzle/PostgreSQL + MinIO(S3 호환) + JWT(httpOnly cookie 회전) + Docker Compose(dev/prod 분리). 폼 제출은 Server Actions(+ `useActionState`), 클라이언트 상호작용은 tRPC mutation(+ `useOptimistic`), 조회는 RSC 또는 TanStack Query prefetch + Hydration.

**Tech Stack:** Next.js 15, React 19, TypeScript, TailwindCSS v4, shadcn/ui, Drizzle ORM, PostgreSQL 16, tRPC v11, TanStack Query v5, jose(JWT), @node-rs/argon2, @aws-sdk/client-s3, MinIO, Tiptap, next-intl, next-themes, React Email + Mailpit + nodemailer, zod, Vitest, pnpm, Docker Compose.

---

## 사용 안내

- 이 문서는 **전체 로드맵 + 마일스톤별 작업 체크리스트** 다.
- 마일스톤 1(부트스트랩)은 **명령어·파일 내용까지 단계별**로 상세하게 적혀 있다. 그대로 따라하면 환경이 선다.
- 마일스톤 2~10 은 **작업 항목·파일 경로·핵심 코드 골격** 위주로 정리되어 있다. 각 마일스톤을 본격 시작할 때, 해당 마일스톤만의 **상세 sub-plan**(`docs/plans/MX-*.md`)을 별도로 작성해 TDD step-by-step 으로 진행하길 권장한다.
- 모든 코드 파일에는 **학습용 한국어 주석**을 다는 것이 NFR-3 이다 (PRD §4 참고).
- 커밋 메시지는 conventional commits 사용: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`.

---

## 마일스톤 개요

| #   | 마일스톤                  | 핵심 산출물                                                                                  | 학습 토픽                                               |
| --- | ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | 부트스트랩                | Next.js 15 + Tailwind v4 + shadcn + Drizzle + tRPC + zod + i18n + `compose.dev.yml` 스켈레톤 | 초기 셋업, Docker 핫리로드                              |
| 2   | DB 스키마 v1              | users, sessions, email_verifications, password_resets + 마이그레이션                         | Drizzle 스키마/마이그레이션, citext, enum               |
| 3   | 인증                      | argon2, jose, 쿠키, 회전, 회원가입/로그인/로그아웃/리프레시 + Mailpit 인증 메일              | `useActionState`, Server Actions, JWT 회전, React Email |
| 4   | 프로필 + Presigned 업로드 | 아바타 업로드 풀 흐름                                                                        | MinIO Presigned PUT, attachments 모델                   |
| 5   | 글 도메인                 | posts/categories/tags/attachments + Tiptap + 인라인 이미지 + CRUD                            | RSC fetch, Tiptap 커스텀 노드, revalidatePath           |
| 6   | 상호작용                  | 댓글/좋아요/북마크 + `useOptimistic` 3종                                                     | `useOptimistic`, tRPC mutation                          |
| 7   | 탐색                      | PG Full-text Search + 태그/카테고리 필터 + 무한 스크롤 + Suspense                            | `useInfiniteQuery`, Suspense, tsvector                  |
| 8   | 관리자                    | ADMIN 라우트, 유저/글 관리                                                                   | RBAC, `requireAdmin` 미들웨어                           |
| 9   | 마감                      | View Transitions, 다크모드, i18n 메시지 완비                                                 | `unstable_ViewTransition`, next-themes, next-intl       |
| 10  | 테스트 & 프로덕션 Docker  | Vitest 단위 테스트, `Dockerfile.prod`, `compose.prod.yml` 빌드                               | Vitest, 멀티 stage Docker, standalone                   |

---

## 마일스톤 1 — 부트스트랩

> **상세 sub-plan**: [./plans/M1-bootstrap.md](./plans/M1-bootstrap.md)

**목표:** `pnpm dev` 가 Docker 컨테이너 안에서 핫리로드와 함께 동작하고, `localhost:3000` 에서 빈 홈페이지가 렌더링된다. PostgreSQL · MinIO · Mailpit · drizzle-studio 가 컨테이너로 떠 있고, tRPC `health.ping` procedure 가 응답한다.

**Definition of Done (DoD):**

- `docker compose -f compose.dev.yml up --build` 으로 모든 컨테이너 healthy.
- 브라우저에서 `/` 가 Tailwind 가 적용된 페이지를 보여준다.
- `/api/trpc/health.ping` 이 `{ "result": { "data": "pong" } }` 류 응답.
- 호스트에서 `.tsx` 파일을 수정하면 컨테이너 내 Next dev 가 즉시 반영.

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`(생략 가능), `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `components.json`(shadcn), `drizzle.config.ts`, `vitest.config.ts`(다음 마일스톤 대비 빈 셋업), `.env.example`, `.gitignore`, `.dockerignore`
- Create: `compose.dev.yml`, `Dockerfile.dev`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/server/trpc/trpc.ts`, `src/server/trpc/context.ts`, `src/server/trpc/routers/_app.ts`, `src/server/trpc/routers/health.ts`
- Create: `src/app/api/trpc/[trpc]/route.ts`
- Create: `src/lib/env.ts`
- Create: `src/components/providers.tsx`
- Test: 이 마일스톤은 인프라 위주라 코드 단위 테스트 없음. 검증은 수동 + curl.

### 단계

- [x] **Step 1.1: `.gitignore` / `.dockerignore` 작성**

`D:\Study\NextJS\nextjs-tutorial\.gitignore`

```gitignore
node_modules
.next
.turbo
dist
coverage
.env
.env.*.local
*.log
.DS_Store
.idea
.vscode
.pnpm-store
```

`D:\Study\NextJS\nextjs-tutorial\.dockerignore`

```dockerignore
node_modules
.next
.git
.turbo
coverage
Dockerfile*
compose*.yml
docs
```

- [x] **Step 1.2: `package.json` 작성**

```json
{
  "name": "nextjs-tutorial",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack -p 3000 -H 0.0.0.0",
    "build": "next build",
    "start": "next start -p 3000 -H 0.0.0.0",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio --host 0.0.0.0"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.59.0",
    "@trpc/server": "^11.0.0-rc.660",
    "@trpc/client": "^11.0.0-rc.660",
    "@trpc/react-query": "^11.0.0-rc.660",
    "@trpc/next": "^11.0.0-rc.660",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.4",
    "zod": "^3.23.8",
    "next-themes": "^0.4.3",
    "next-intl": "^3.25.0",
    "superjson": "^2.2.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.15.0",
    "eslint-config-next": "^15.1.0",
    "drizzle-kit": "^0.28.0",
    "vitest": "^2.1.5",
    "@vitejs/plugin-react": "^4.3.3"
  },
  "packageManager": "pnpm@9.12.3"
}
```

> 버전은 이 시점의 최신 안정 버전 기준. `pnpm install` 후 `pnpm-lock.yaml` 이 생성되면 그걸 신뢰한다.

- [x] **Step 1.3: `tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": true,
    "incremental": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [x] **Step 1.4: `next.config.ts` 작성**

```ts
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
    // RSC 안에서 외부 패키지 import 안정화.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
```

- [x] **Step 1.5: Tailwind v4 + PostCSS 설정**

`postcss.config.mjs`

```js
// Tailwind v4 의 공식 PostCSS 플러그인.
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

`tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  // v4 는 컨테이너 자동 감지지만, content 명시로 트리쉐이킹 보장.
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class", // next-themes 와 결합.
};

export default config;
```

`src/app/globals.css`

```css
@import "tailwindcss";

/* shadcn/ui 호환 변수는 마일스톤 9 에서 정식 추가한다. 현재는 최소 셋업. */
:root {
  color-scheme: light dark;
}

html,
body {
  height: 100%;
}
```

- [x] **Step 1.6: 환경변수 검증 모듈 `src/lib/env.ts`**

```ts
// 학습용: 부팅 시점에 환경변수를 zod 로 강제 검증한다.
// 누락/오타 시 명확한 에러를 던져, 런타임에서 undefined 가 떠다니는 일을 막는다.
import { z } from "zod";

const Env = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_PUBLIC_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),
  DEFAULT_LOCALE: z.enum(["ko", "en"]).default("ko"),
  SUPPORTED_LOCALES: z.string().default("ko,en"),
});

// process.env 는 string|undefined 라 zod 파싱이 안전하다.
export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
```

- [x] **Step 1.7: tRPC 기본 셋업**

`src/server/trpc/trpc.ts`

```ts
// tRPC 초기화 — context 와 transformer(superjson) 만 지정.
// 권한 미들웨어는 마일스톤 3 에서 추가한다.
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
```

`src/server/trpc/context.ts`

```ts
// HTTP 요청 → tRPC context 생성.
// 지금은 비어 있지만, 마일스톤 3 에서 user/세션을 채운다.
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export function createContext(_opts: FetchCreateContextFnOptions) {
  return { user: null as null | { id: string; role: "USER" | "ADMIN" } };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
```

`src/server/trpc/routers/health.ts`

```ts
// 부팅 검증용. 라우터 구조 학습 목적.
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  ping: publicProcedure.query(() => "pong"),
});
```

`src/server/trpc/routers/_app.ts`

```ts
// 모든 도메인 라우터를 여기에 합친다.
import { router } from "../trpc";
import { healthRouter } from "./health";

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
```

`src/app/api/trpc/[trpc]/route.ts`

```ts
// App Router 에 fetch 어댑터로 tRPC 를 마운트.
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createContext(opts),
  });

export { handler as GET, handler as POST };
```

- [x] **Step 1.8: 최소 페이지 + Provider**

`src/components/providers.tsx`

```tsx
"use client";
// 클라이언트 측 Provider 모음. 지금은 TanStack Query 만.
// next-themes·next-intl Provider 는 마일스톤 9 에서 추가.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";

export function Providers({ children }: PropsWithChildren) {
  // 컴포넌트 마운트 1회만 QueryClient 생성.
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

`src/app/layout.tsx`

```tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "학습용 블로그",
  description: "Next.js 15 + React 19 학습 프로젝트",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // i18n 은 마일스톤 9 에서 [locale] segment 로 정식 도입. 지금은 ko 고정.
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`src/app/page.tsx`

```tsx
// 부팅 검증 페이지. 마일스톤 5 에서 진짜 피드로 교체된다.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">학습용 블로그 🚀</h1>
      <p className="text-sm text-zinc-500">
        부트스트랩이 정상 동작 중입니다. 다음 마일스톤은 DB 스키마입니다.
      </p>
    </main>
  );
}
```

- [x] **Step 1.9: Drizzle 설정 (스키마는 비워두기)**

`drizzle.config.ts`

```ts
// 마이그레이션 산출물 위치와 DB 연결 정보를 drizzle-kit 에 알려준다.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema/*",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  verbose: true,
  strict: true,
});
```

> 스키마 파일은 마일스톤 2 에서 추가한다. 지금은 `src/server/db/schema/.gitkeep` 만 생성.

- [x] **Step 1.10: `.env.example` 작성**

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

# DB (compose.dev.yml 의 postgres 컨테이너)
DATABASE_URL=postgres://postgres:postgres@postgres:5432/blog

# JWT — 마일스톤 3 에서 사용. 32 글자 이상의 랜덤 문자열.
JWT_ACCESS_SECRET=change-me-please-change-me-please-32+
JWT_REFRESH_SECRET=change-me-please-change-me-please-32+
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000

# MinIO (compose.dev.yml 의 minio 컨테이너)
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=blog
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_PUBLIC_URL=http://localhost:9000

# Mail (Mailpit)
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM="Blog <no-reply@blog.local>"

# i18n
DEFAULT_LOCALE=ko
SUPPORTED_LOCALES=ko,en
```

> 실제 `.env` 파일은 위 내용을 복사해 만든다. `.gitignore` 에 포함되어 있으므로 안전.

- [x] **Step 1.11: `Dockerfile.dev`**

```dockerfile
# 개발용 컨테이너: 의존성만 미리 설치하고, 소스는 bind mount 로 갈아끼운다.
FROM node:22-alpine

WORKDIR /app

# Alpine 환경에서 일부 네이티브 모듈(@node-rs/argon2 등) 빌드를 위해 필요할 수 있는 도구.
RUN apk add --no-cache libc6-compat \
    && corepack enable

# 의존성 설치 캐시 레이어.
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# 핫리로드는 bind mount 로 가져온 소스를 watch 한다.
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true

EXPOSE 3000
CMD ["pnpm", "dev"]
```

- [x] **Step 1.12: `compose.dev.yml`**

```yaml
# 개발용 — bind mount 로 핫리로드, 의존성은 컨테이너의 node_modules 를 유지(named volume).
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: blog
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 10

  # 최초 부팅 시 버킷을 자동 생성.
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      (mc mb local/blog || true) &&
      mc anonymous set download local/blog;
      "
    restart: "no"

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # Web UI

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file: .env
    environment:
      # 컨테이너 안에서는 서비스 이름으로 접근.
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/blog
      S3_ENDPOINT: http://minio:9000
      SMTP_HOST: mailpit
    volumes:
      - .:/app
      # node_modules 는 호스트 OS(Windows) 와 분리 — 성능/일관성 위해 named volume.
      - node_modules:/app/node_modules
      - next_cache:/app/.next
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
      mailpit:
        condition: service_started

  # Drizzle Studio (옵션 프로필) — `--profile tools` 로 실행.
  drizzle-studio:
    profiles: ["tools"]
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/blog
    command: ["pnpm", "db:studio"]
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    ports:
      - "4983:4983"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
  miniodata:
  node_modules:
  next_cache:
```

- [x] **Step 1.13: shadcn 초기화 안내 파일 `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

> 실제 컴포넌트는 마일스톤 9 에서 `pnpm dlx shadcn@latest add button input ...` 으로 필요할 때 추가.

- [x] **Step 1.14: 빌드 & 기동**

호스트에서 실행:

```bash
cp .env.example .env
docker compose -f compose.dev.yml up --build
```

- [x] **Step 1.15: 수동 검증**

1. `http://localhost:3000` → "학습용 블로그 🚀" 페이지 확인.
2. `curl 'http://localhost:3000/api/trpc/health.ping?batch=1&input=%7B%220%22%3A%7B%7D%7D'` → `"pong"` 포함 응답.
3. `http://localhost:8025` → Mailpit UI 접속.
4. `http://localhost:9001` → MinIO 콘솔 (minioadmin / minioadmin) 로그인, `blog` 버킷 존재 확인.
5. `src/app/page.tsx` 의 텍스트를 수정 → 브라우저 자동 리로드 확인.

- [x] **Step 1.16: 커밋**

```bash
git init
git add .
git commit -m "feat(bootstrap): Next.js 15 + Docker dev compose + tRPC health"
```

---

## 마일스톤 2 — DB 스키마 v1 (인증 도메인)

> **상세 sub-plan**: [./plans/M2-db-schema.md](./plans/M2-db-schema.md)

**목표:** users / sessions / email_verifications / password_resets 4개 테이블 + 마이그레이션 파일이 생성·적용되어 `psql` 에서 조회 가능. Drizzle 쿼리로 INSERT/SELECT 가 동작.

**DoD:** `pnpm db:generate` → SQL 파일 생성 → `pnpm db:migrate` 적용 → drizzle-studio 에서 4개 테이블 시각 확인.

**Files:**

- Create: `src/server/db/client.ts` (postgres.js + drizzle 인스턴스)
- Create: `src/server/db/schema/users.ts`
- Create: `src/server/db/schema/sessions.ts`
- Create: `src/server/db/schema/tokens.ts` (email_verifications, password_resets)
- Create: `src/server/db/schema/index.ts` (모든 스키마 re-export)
- Create: `src/server/db/migrations/` (drizzle-kit 산출물, 커밋 대상)

### 작업 체크리스트

- [ ] `pg_extension`: `citext`, `pgcrypto` 활성화 마이그레이션을 첫 번째로 둔다 (Drizzle 의 `sql` 헬퍼로 `CREATE EXTENSION IF NOT EXISTS ...`).
- [ ] `users` 스키마: id(uuid PK default gen_random_uuid), email(citext unique), password_hash, nickname, bio, avatar_key, role(enum 'USER'|'ADMIN'), email_verified_at, is_active(default true), created_at/updated_at(default now).
- [ ] `sessions` 스키마: id(uuid PK), user_id(FK cascade), refresh_token_hash, user_agent, ip(inet), expires_at, revoked_at, replaced_by(uuid self-ref), created_at. 인덱스: user_id, expires_at.
- [ ] `email_verifications`, `password_resets` 공통 구조 → 둘 다 `tokens.ts` 한 파일에서 정의. user_id FK cascade, token_hash, expires_at, used_at.
- [ ] `client.ts`: `postgres` 클라이언트 + `drizzle()` export. 학습 주석으로 connection pool 동작 설명.
- [ ] `pnpm db:generate` → 생성된 SQL 파일을 열어 의도대로 생성되었는지 확인 후 커밋.
- [ ] `pnpm db:migrate` 컨테이너에서 실행: `docker compose -f compose.dev.yml exec app pnpm db:migrate`.
- [ ] drizzle-studio 기동: `docker compose -f compose.dev.yml --profile tools up drizzle-studio`, `http://localhost:4983` 접속 검증.
- [ ] 커밋: `feat(db): users/sessions/tokens schema + initial migration`.

### 검증 SQL

```sql
\dt
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users';
```

---

## 마일스톤 3 — 인증 (회원가입/로그인/로그아웃/리프레시 + 이메일 인증)

> **상세 sub-plan**: [./plans/M3-auth.md](./plans/M3-auth.md)

**목표:** 회원가입 → Mailpit 인증 메일 → 로그인 → access/refresh httpOnly 쿠키 발급 → 보호된 페이지 접근 → access 만료 시 자동 refresh 회전 → 로그아웃까지 풀 플로우. `useActionState` + `useFormStatus` 가 회원가입/로그인 폼에서 학습된다.

**DoD:**

- Mailpit UI 에서 인증 메일 수신·클릭 → `email_verified_at` 갱신.
- 로그인 후 DevTools 에 access/refresh 쿠키 두 개 확인.
- access 강제 만료(또는 짧은 TTL) 후 보호 API 호출 → `/api/auth/refresh` 가 회전하고 새 쿠키 발급.
- refresh 재사용(같은 토큰으로 두 번째 회전 시도) 시 해당 user 의 모든 세션이 revoke 됨.

**Files:**

- Create: `src/server/auth/password.ts` — argon2id 해시/검증.
- Create: `src/server/auth/jwt.ts` — jose 로 access/refresh 발급·검증.
- Create: `src/server/auth/cookies.ts` — httpOnly, Secure, SameSite=Lax 쿠키 set/clear.
- Create: `src/server/auth/session.ts` — 세션 행 생성, 회전(`rotate`), 재사용 감지(`detectReuse`), 로그아웃.
- Create: `src/server/auth/tokens.ts` — 이메일 인증·비번 재설정 토큰 발급/검증(SHA-256 해시).
- Create: `src/server/mail/transport.ts` — nodemailer + Mailpit 트랜스포트.
- Create: `src/server/mail/templates/verify-email.tsx` — React Email 템플릿.
- Create: `src/server/mail/templates/reset-password.tsx` — React Email 템플릿.
- Create: `src/server/actions/auth.ts` — Server Actions(`signUpAction`, `signInAction`, `signOutAction`, `requestPasswordResetAction`, `resetPasswordAction`).
- Create: `src/app/api/auth/refresh/route.ts` — refresh 회전 Route Handler.
- Create: `src/app/[locale]/(auth)/sign-up/page.tsx`, `src/app/[locale]/(auth)/sign-in/page.tsx`, `src/app/[locale]/(auth)/verify-email/page.tsx`, `src/app/[locale]/(auth)/forgot-password/page.tsx`, `src/app/[locale]/(auth)/reset-password/page.tsx`.
- Create: `src/components/auth/sign-up-form.tsx`, `sign-in-form.tsx` — `useActionState` + `useFormStatus` 사용.
- Modify: `src/server/trpc/context.ts` — 쿠키에서 access 검증 후 `ctx.user` 채움.
- Modify: `src/server/trpc/trpc.ts` — `protectedProcedure` 추가.
- Modify: `next.config.ts` 또는 별도 `src/middleware.ts` — `/me/*`, `/posts/new` 등 보호 경로에 access 존재 여부 검사.
- Add deps: `jose`, `@node-rs/argon2`, `nodemailer`, `@types/nodemailer`, `react-email`, `@react-email/components`.

### 작업 체크리스트

- [ ] **password.ts**: argon2id `hash(plain)` / `verify(hash, plain)` wrapper + 학습용 주석으로 OWASP 권장 파라미터 설명.
- [ ] **jwt.ts**: `signAccess({sub, role})`, `verifyAccess(token)`, `signRefresh({sub, jti})`, `verifyRefresh(token)` — jose `SignJWT` + `jwtVerify`.
- [ ] **cookies.ts**: `setAuthCookies(headers, {access, refresh})`, `clearAuthCookies(headers)`, `getAuthCookies()` (Server Component/Action 에서 `cookies()` 사용).
- [ ] **session.ts**:
  - `createSession({userId, ua, ip})` → refresh JWT 발급 + DB 행 생성(SHA-256(refresh) 저장).
  - `rotate(refreshToken)` → ① 검증 ② DB 조회 ③ revoked 면 `detectReuse` 호출 ④ 새 sessionId 발급 ⑤ 기존 revoke + `replaced_by` 설정.
  - `detectReuse(userId)` → 해당 user 의 모든 sessions revoke.
  - `revoke(sessionId)` → 로그아웃.
- [ ] **tokens.ts**: `issueEmailVerification(userId)` / `consumeEmailVerification(plain)` / 동일 패턴으로 password reset.
- [ ] **mail/transport.ts**: `nodemailer.createTransport({host: SMTP_HOST, port: SMTP_PORT, secure: false})`.
- [ ] **mail/templates/**: React Email `<Html>` 기반 두 종 + 한국어 카피.
- [ ] **actions/auth.ts**:
  - `signUpAction(prevState, formData)`: zod 검증 → 이메일 중복 체크 → argon2 해시 → users INSERT → 이메일 인증 토큰 발급 → 메일 발송 → `{ok: true, message: "메일을 확인해주세요"}`.
  - `signInAction(prevState, formData)`: 검증 → users 조회 → argon2 verify → `email_verified_at` 확인 → 세션 생성 → 쿠키 설정 → `redirect("/")`.
  - `signOutAction()`: 세션 revoke + 쿠키 삭제 → `redirect("/sign-in")`.
  - `requestPasswordResetAction(formData)`, `resetPasswordAction(prevState, formData)`.
- [ ] **/api/auth/refresh route.ts**: POST 또는 GET. refresh 쿠키 추출 → `rotate` → 새 쿠키 응답. 클라이언트(tRPC link)에서 401 가로채 호출.
- [ ] **context.ts 수정**: access 쿠키 검증 → 실패 시 `user=null`, 성공 시 `{id, role}` 채움.
- [ ] **trpc.ts 수정**: `protectedProcedure = publicProcedure.use(({ctx, next}) => { if(!ctx.user) throw UNAUTHORIZED; return next({ctx: {user: ctx.user}}) })`.
- [ ] **middleware.ts**: 보호 경로(`/me`, `/posts/new`, `/posts/[slug]/edit`, `/admin`) 접근 시 access 쿠키 존재만 체크 (서명 검증은 RSC/tRPC 에서).
- [ ] **폼 컴포넌트**: `useActionState(signUpAction, initialState)` + `useFormStatus()` 로 pending UI. shadcn `Input`/`Button` 사용 (Step 9 전이라면 임시 raw HTML 도 무방).
- [ ] **Mailpit 시나리오 수동 검증**: 회원가입 → Mailpit `http://localhost:8025` → 메일 클릭 링크 → `verify-email` 페이지에서 토큰 consume → 성공 메시지.
- [ ] **회전 시나리오 검증**: JWT_ACCESS_TTL 을 임시로 30 으로 줄이고 1분 대기 → 자동 refresh 확인. 같은 refresh 두 번 호출 시 user 전체 revoke 확인.
- [ ] 커밋들을 잘게: `feat(auth): argon2 + jose primitives`, `feat(auth): session rotation`, `feat(auth): sign-up/sign-in server actions`, `feat(auth): email verification with mailpit`.

---

## 마일스톤 4 — 프로필 + MinIO Presigned 업로드

> **상세 sub-plan**: [./plans/M4-profile-upload.md](./plans/M4-profile-upload.md)

**목표:** 로그인된 사용자가 닉네임/소개를 수정하고, 아바타 이미지를 presigned PUT 으로 직접 MinIO 에 업로드한다. MinIO 콘솔에서 객체 확인, 프로필 페이지에서 즉시 노출.

**DoD:** `/me` 에서 아바타 변경 → 새 객체가 MinIO `blog/avatars/...` 에 저장 → 페이지 새로고침 시 변경된 이미지 노출.

**Files:**

- Create: `src/server/db/schema/attachments.ts` — attachments 테이블 (enum 포함). 마이그레이션 추가.
- Modify: `src/server/db/schema/users.ts` — `avatar_attachment_id` 또는 그냥 `avatar_key` 유지 (PRD 따라 `avatar_key`).
- Create: `src/server/storage/s3.ts` — S3 client (`endpoint: env.S3_ENDPOINT`, `forcePathStyle: true`).
- Create: `src/server/storage/presign.ts` — `requestUpload({kind, mime, size})` → presigned PUT URL + objectKey 발급, `presignedGet(key)`.
- Create: `src/server/trpc/routers/profile.ts` — `me`, `update`, `requestAvatarUpload`, `confirmAvatar`.
- Modify: `src/server/trpc/routers/_app.ts` — profile 라우터 등록.
- Create: `src/app/[locale]/(main)/me/page.tsx` — RSC 가 현재 user 로딩, ClientForm 으로 위임.
- Create: `src/components/profile/profile-form.tsx` — 닉네임/소개 form (Server Action `updateProfileAction` 사용).
- Create: `src/components/profile/avatar-uploader.tsx` — Client Component: 파일 선택 → tRPC `requestAvatarUpload` → 직접 PUT → `confirmAvatar` → `router.refresh()`.
- Add deps: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

### 작업 체크리스트

- [ ] **attachments 테이블 + enum('AVATAR','POST_INLINE','POST_ATTACHMENT')** 마이그레이션. post_id NULLABLE.
- [ ] **s3.ts**: `S3Client({region, endpoint, credentials, forcePathStyle: true})` — MinIO 는 path style 필수.
- [ ] **presign.ts**:
  - `keyFor(kind, ext)` → 예: `avatars/2026/05/<uuid>.<ext>`, `posts/2026/05/<uuid>.<ext>`.
  - `requestUpload({kind, mime, sizeBytes, userId})`:
    - 화이트리스트(MIME, 사이즈) 검증 — 위반 시 tRPC `BAD_REQUEST`.
    - `getSignedUrl(s3, new PutObjectCommand({Bucket, Key, ContentType: mime}), {expiresIn: 300})`.
    - return `{uploadUrl, objectKey, headers: {"Content-Type": mime}}`.
- [ ] **profile 라우터**:
  - `me: protectedProcedure.query(...)` — DB 에서 user 조회 후 `avatar_key` → 공개 URL(`env.S3_PUBLIC_URL/{bucket}/{key}`)로 변환해 반환.
  - `update: protectedProcedure.input(z.object({nickname, bio?})).mutation(...)`.
  - `requestAvatarUpload: protectedProcedure.input(z.object({mime, sizeBytes})).mutation(...)` — kind=AVATAR 로 presign 호출.
  - `confirmAvatar: protectedProcedure.input(z.object({objectKey, originalName, mime, sizeBytes})).mutation(...)` — attachments INSERT(kind=AVATAR) + users.avatar_key 갱신.
- [ ] **avatar-uploader.tsx** 흐름:
  1. `<input type="file" accept="image/jpeg,image/png,image/webp" />` 선택.
  2. 클라이언트 사이즈/MIME 1차 검증.
  3. `requestAvatarUpload` mutate → `{uploadUrl, objectKey, headers}` 수신.
  4. `fetch(uploadUrl, { method: 'PUT', headers, body: file })`.
  5. 성공 시 `confirmAvatar` 호출.
  6. `router.refresh()` 로 RSC 재실행.
- [ ] **CORS 주의**: 브라우저 → MinIO 직접 PUT 이라 MinIO CORS 가 허용되어 있어야 한다. `minio-init` 컨테이너 entrypoint 에 `mc admin config set local api cors_allow_origin="*"` 추가(개발용).
- [ ] 수동 검증: 업로드 후 MinIO 콘솔에서 객체 확인, 프로필 페이지 새 이미지 노출, attachments 테이블에 row 존재.
- [ ] 커밋: `feat(storage): minio s3 client + presign`, `feat(profile): update + avatar upload`.

---

## 마일스톤 5 — 글 도메인 (CRUD + Tiptap + 첨부)

> **상세 sub-plan**: [./plans/M5-posts.md](./plans/M5-posts.md)

**목표:** 글 작성 페이지에서 Tiptap 으로 본문 작성, 본문 안에 이미지 삽입(presigned), 별도 첨부 파일 영역, 카테고리/태그 선택 → 저장. 목록/상세/수정/삭제.

**DoD:** 로그인 후 `/posts/new` 에서 글 작성(본문 이미지 1개 + 첨부 1개) → 저장 → 목록/상세에서 정상 노출 → 작성자만 수정/삭제 가능 → 비작성자 접근 시 403 / 미노출.

**Files:**

- Create: `src/server/db/schema/posts.ts`, `categories.ts`, `tags.ts`, `post_tags.ts` (조인). 마이그레이션 추가. `posts.search_tsv` 는 마일스톤 7 에서 추가하므로 우선 nullable 컬럼 또는 생략 가능 — 단, 후행 ALTER 보다 처음부터 생성 컬럼으로 두는 게 편하다.
- Create: `src/server/trpc/routers/post.ts` — `list`(temp: 최신순 페이지네이션, 무한 스크롤은 M7), `bySlug`, `create`, `update`, `delete`, `requestAttachmentUpload`, `confirmAttachment`.
- Create: `src/server/actions/post.ts` — `createPostAction`, `updatePostAction`, `deletePostAction` (Server Action + `revalidatePath`/`revalidateTag`).
- Create: `src/components/editor/tiptap-editor.tsx` — Tiptap React, 이미지 노드 커스텀(업로드 핸들러), 코드블록, 링크.
- Create: `src/components/editor/upload-image-extension.ts` — 드래그/붙여넣기 → presigned 업로드 → 노드 src 갱신.
- Create: `src/components/post/post-form.tsx` — 제목/카테고리/태그/공개여부/Tiptap/첨부.
- Create: `src/components/post/attachment-list.tsx` — 첨부 파일 영역(추가/삭제).
- Create: `src/app/[locale]/(main)/posts/new/page.tsx`, `[slug]/page.tsx`, `[slug]/edit/page.tsx`.
- Modify: `src/server/trpc/routers/_app.ts` — post 라우터 등록.
- Add deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `slugify`, `dompurify`(server) 또는 자체 노드 화이트리스트 sanitize.

### 작업 체크리스트

- [ ] **스키마**:
  - `categories(id uuid pk, slug citext unique, name)`.
  - `tags(id uuid pk, slug citext unique, name)`.
  - `posts(...)` PRD §5 그대로. `content_json` jsonb, `content_text` text, `search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'')||' '||coalesce(content_text,''))) STORED` 인덱스 `GIN(search_tsv)`.
  - `post_tags(post_id, tag_id)` 복합 PK.
- [ ] **시드**: `pnpm tsx scripts/seed.ts` 같은 스크립트로 categories 3개(`일반/학습/회고`) INSERT (idempotent).
- [ ] **slug 정책**: `slugify(title)` + 충돌 시 `-<shortuuid>` 접미.
- [ ] **post.create**:
  - 입력 zod: `{title, contentJson, contentText, categoryId?, tagSlugs: string[], isPublished}`.
  - 트랜잭션으로 post INSERT → tag upsert by slug → post_tags INSERT.
  - 본문 인라인 이미지의 objectKey 들은 클라이언트가 `confirmAttachment` 로 이미 등록해뒀다고 가정 → post.create 시 `attachments.post_id` 업데이트(작성자 ownership 검증).
- [ ] **post.update**: 작성자 또는 ADMIN 만. 변경된 태그 차집합 처리.
- [ ] **post.delete**: 작성자 또는 ADMIN. attachments ON DELETE CASCADE 로 자동 정리. (단, MinIO 객체 자체는 별도 GC 작업 필요 — 학습 범위 밖, TODO 주석만.)
- [ ] **Tiptap 이미지 확장**: `addPasteRules`, `addInputRules`, `onUpload(file) → presignedPut → confirmAttachment(kind=POST_INLINE, postId=null) → setSrc(공개URL)`.
- [ ] **첨부 영역**: 단일/다중 파일, 진행률 표시(`fetch` 의 ReadableStream + 클라이언트 측 진행률 계산은 학습 옵션).
- [ ] **글 상세 RSC**: `bySlug` 호출 → Tiptap JSON 을 서버에서 안전한 HTML 로 렌더링(generateHTML from `@tiptap/html`) → 클라이언트는 정적 HTML 만 받음. XSS 방지(NFR-1) 위해 허용 노드 화이트리스트 함수로 한 번 더 sanitize.
- [ ] **`revalidatePath('/[locale]')`, `revalidatePath('/[locale]/posts/[slug]')`** 를 액션에서 호출 → 캐시 무효화 학습.
- [ ] 커밋들: `feat(db): posts/tags/categories schema`, `feat(post): trpc CRUD`, `feat(editor): tiptap with presigned image upload`, `feat(post): create/edit/detail pages`.

---

## 마일스톤 6 — 상호작용 (댓글/좋아요/북마크 + `useOptimistic`)

> **상세 sub-plan**: [./plans/M6-interactions.md](./plans/M6-interactions.md)

**목표:** 글 상세에서 댓글 작성·삭제·대댓글, 좋아요/북마크 토글이 클릭 즉시 UI 에 반영(낙관적 업데이트)되고 실패 시 롤백. 세 곳 모두 `useOptimistic` 학습.

**DoD:** 의도적으로 mutation 에 `await new Promise(r=>setTimeout(r,1000))` 삽입해도 UI 는 즉시 반영 → 1초 후 서버 결과로 sync. 의도적으로 throw 하면 UI 가 원래대로 롤백.

**Files:**

- Create: `src/server/db/schema/comments.ts`, `likes.ts`, `bookmarks.ts`. 마이그레이션.
- Create: `src/server/trpc/routers/comment.ts`, `like.ts`, `bookmark.ts`.
- Modify: `_app.ts` — 세 라우터 등록.
- Create: `src/components/comment/comment-list.tsx` — Server Component (RSC fetch).
- Create: `src/components/comment/comment-form.tsx` — Client, `useOptimistic` + `useActionState`.
- Create: `src/components/post/like-button.tsx` — Client, `useOptimistic`.
- Create: `src/components/post/bookmark-button.tsx` — Client, `useOptimistic`.
- Create: `src/app/[locale]/(main)/me/bookmarks/page.tsx` — 내 북마크 목록 (RSC).

### 작업 체크리스트

- [ ] **comments 스키마**: `parent_id` self FK, **앱 레이어에서** parent_id 가 또 다른 parent 를 가진 경우 거부(1단계만).
- [ ] **likes/bookmarks**: 복합 PK `(user_id, post_id)`.
- [ ] **comment.create**: 입력 검증, 글 존재 확인, 본문 1~1000자, 부모 댓글 존재·1단계 검증.
- [ ] **comment.delete**: 본인 또는 ADMIN.
- [ ] **like.toggle**, **bookmark.toggle**: UPSERT 또는 INSERT ON CONFLICT DO NOTHING / DELETE 로 토글. 반환은 새 상태(`{liked: boolean, count: number}`).
- [ ] **댓글 영역 RSC** + **Suspense** 로 감싸 글 상세 streaming 학습 (M3 의 글 상세 페이지 수정):
  ```tsx
  <Suspense fallback={<CommentSkeleton />}>
    <CommentList postId={post.id} />
  </Suspense>
  ```
- [ ] **`useOptimistic` 패턴 예**:
  ```tsx
  const [optimistic, addOptimistic] = useOptimistic(
    serverState,
    (prev, action: {type:'add', tempId:string, content:string}) => [...prev, {id:action.tempId, content:action.content, pending:true}]
  );
  async function action(formData: FormData) {
    const content = String(formData.get('content'));
    const tempId = crypto.randomUUID();
    addOptimistic({type:'add', tempId, content});
    try { await trpc.comment.create.mutate({...}); } catch { /* RSC refetch 시 자동 롤백 */ }
  }
  ```
- [ ] 검증: DevTools Network throttling 으로 Slow 3G → 즉시 반영 확인.
- [ ] 커밋: `feat(comment): trpc + optimistic UI`, `feat(post): like/bookmark optimistic toggles`.

---

## 마일스톤 7 — 탐색 (검색 + 필터 + 무한 스크롤)

> **상세 sub-plan**: [./plans/M7-discovery.md](./plans/M7-discovery.md)

**목표:** 메인 피드와 검색 페이지에서 무한 스크롤이 동작하고, PostgreSQL Full-text Search 로 제목/본문 검색이 정상 동작. Suspense 로 첫 페이지는 SSR, 이후 페이지는 클라이언트 fetch.

**DoD:** `/?tag=...`, `/?category=...`, `/search?q=...` 셋 다 무한 스크롤로 페이지가 증가하고, 검색은 한글/영문 모두 매칭.

**Files:**

- Modify: `post` 라우터 — `list(input: {cursor?, limit, tag?, category?})` 가 `useInfiniteQuery` 가 기대하는 `{items, nextCursor}` 반환.
- Create: `post.search(input: {q, cursor?, limit})` — `WHERE search_tsv @@ websearch_to_tsquery('simple', $q)` + `ts_rank` 정렬.
- Create: `src/components/post/post-feed.tsx` — Client Component: `trpc.post.list.useInfiniteQuery(...)`, IntersectionObserver 로 자동 다음 페이지.
- Create: `src/app/[locale]/(main)/page.tsx` — RSC: `helpers.post.list.prefetchInfinite(...)` + `<HydrationBoundary state={dehydrate(qc)}><Suspense><PostFeed/></Suspense></HydrationBoundary>`.
- Create: `src/app/[locale]/(main)/search/page.tsx` — 동일 패턴, `q` query.
- Create: `src/app/[locale]/(main)/tags/[slug]/page.tsx`, `categories/[slug]/page.tsx`.
- Create: `src/lib/trpc-server.ts` — RSC 안에서 tRPC `createCaller` 또는 `createServerSideHelpers` 셋업.
- Add deps: 이미 다 있음. `@tanstack/react-query` v5 의 `HydrationBoundary` 활용.

### 작업 체크리스트

- [ ] **cursor 설계**: `(created_at desc, id desc)` 복합 cursor → base64(`${ts}_${id}`).
- [ ] **post.list**: drizzle `where lt((created_at, id), cursor)` 식 keyset pagination.
- [ ] **post.search**: `websearch_to_tsquery('simple', $q)`, `ORDER BY ts_rank(search_tsv, query) DESC, created_at DESC`.
- [ ] **RSC prefetch**: `createServerSideHelpers({ router: appRouter, ctx: createContext(...) })` → `await helpers.post.list.prefetchInfinite({limit:10})` → `dehydrate(helpers.queryClient)`.
- [ ] **PostFeed**: `useInfiniteQuery({getNextPageParam: (last) => last.nextCursor})`. `IntersectionObserver` 로 sentinel 가시 시 `fetchNextPage()`.
- [ ] **Suspense 적용**: feed 컴포넌트가 Suspense fallback 으로 스켈레톤 표시.
- [ ] **검증 시나리오**: 글을 15개 시드 → 첫 10개 SSR, 스크롤 시 5개 추가. 검색어 "한글"/"english" 양쪽 확인.
- [ ] 커밋: `feat(post): keyset pagination`, `feat(post): full-text search`, `feat(feed): infinite scroll with prefetch+hydration`.

---

## 마일스톤 8 — 관리자 (ADMIN)

> **상세 sub-plan**: [./plans/M8-admin.md](./plans/M8-admin.md)

**목표:** ADMIN 사용자만 `/admin/*` 접근. 유저 목록/검색/비활성화, 글 목록/숨김/삭제.

**DoD:** 일반 유저로 `/admin` 접근 시 redirect / 404. ADMIN 으로 유저 비활성화 → 해당 유저는 로그인 시 401, 글은 자동 숨김 처리.

**Files:**

- Modify: `src/server/trpc/trpc.ts` — `adminProcedure = protectedProcedure.use(({ctx,next}) => { if(ctx.user.role!=='ADMIN') throw FORBIDDEN; return next() })`.
- Create: `src/server/trpc/routers/admin.ts` — `users.list/setActive`, `posts.list/setHidden`.
- Create: `src/app/[locale]/(admin)/admin/layout.tsx` — ADMIN 가드(서버에서 `ctx.user.role !== 'ADMIN'` 이면 `notFound()`).
- Create: `src/app/[locale]/(admin)/admin/users/page.tsx`, `admin/posts/page.tsx`.
- Modify: `middleware.ts` — `/admin/*` 에 access 쿠키 존재 검사 추가 (서명 검증은 RSC layer 가 함).
- Modify: `src/server/db/schema/users.ts` 인덱스 — `email` GIN trgm (검색용) 학습 옵션.

### 작업 체크리스트

- [ ] **시드 ADMIN 생성 스크립트**: `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 존재 시 1회 생성(`scripts/seed-admin.ts`).
- [ ] **users.list**: 검색어, 페이지네이션, role/active 필터.
- [ ] **users.setActive**: `is_active` 토글 + active=false 일 때 모든 sessions revoke (해당 유저 즉시 로그아웃).
- [ ] **posts.list**: 숨김 포함 전체 목록.
- [ ] **posts.setHidden**: `is_hidden` 토글. 공개 목록 쿼리는 `where is_hidden=false`.
- [ ] **공개 라우트 가드**: `post.list/bySlug` 에서 작성자 또는 ADMIN 이 아닌 경우 `is_hidden=true` 제외.
- [ ] 커밋: `feat(admin): adminProcedure + admin routers`, `feat(admin): users/posts management pages`.

---

## 마일스톤 9 — 마감 (View Transitions, 다크모드, i18n)

> **상세 sub-plan**: [./plans/M9-finish.md](./plans/M9-finish.md)

**목표:** shadcn 컴포넌트 정식 도입, 다크모드 토글 동작, 한/영 라우트 전환, 글 목록 → 상세 페이지 전환에 View Transitions 적용.

**DoD:** 우상단 테마 토글 동작, `/ko/...` ↔ `/en/...` 전환 시 메시지 변경, 글 카드 → 상세 진입 시 부드러운 transition.

**Files:**

- Run: `pnpm dlx shadcn@latest init` → 이미 `components.json` 있으므로 update.
- Run: `pnpm dlx shadcn@latest add button input textarea card dialog dropdown-menu form label sheet toast skeleton avatar tabs`.
- Modify: `src/components/providers.tsx` — `<ThemeProvider attribute="class" defaultTheme="system">` (next-themes) + `<NextIntlClientProvider>` 래핑.
- Create: `src/i18n/config.ts`, `src/i18n/request.ts` (next-intl App Router 표준), `src/i18n/messages/ko.json`, `en.json`.
- Modify: `src/app/[locale]/layout.tsx` — `getMessages()` 와 `NextIntlClientProvider` 연결.
- Create: `src/middleware.ts` — next-intl middleware + 보호 경로 가드 결합.
- Create: `src/components/theme-toggle.tsx`, `language-switcher.tsx`.
- Modify: 글 목록 카드 / 상세 페이지 — `<unstable_ViewTransition>` 으로 감싸기 (Next.js 15 의 React 19 wrapper).
- Add deps: `next-intl` 은 이미 있음. shadcn 의존 패키지(`@radix-ui/*`) 자동 추가됨.

### 작업 체크리스트

- [ ] **next-intl 라우팅**: `[locale]` segment, `locales=['ko','en']`, `defaultLocale='ko'`. 매칭 안 되는 경로는 redirect.
- [ ] **messages**: 인증/네비/공통 키 30~50개 정의.
- [ ] **shadcn 컴포넌트 정착**: 기존 raw HTML 폼들을 `Form`, `Input`, `Button`, `Card`, `Dialog` 로 교체.
- [ ] **테마 토글**: Avatar 옆 `DropdownMenu` 에 light/dark/system 3옵션.
- [ ] **View Transitions** 적용 예:
  ```tsx
  import { unstable_ViewTransition as ViewTransition } from "react";
  <ViewTransition name={`post-${post.id}`}>
    <Card>...</Card>
  </ViewTransition>;
  ```
  글 카드와 상세 페이지의 같은 `name` 으로 묶기.
- [ ] **CSS**: `::view-transition-old(*)` / `::view-transition-new(*)` 기본 트랜지션 학습.
- [ ] 커밋: `feat(ui): shadcn primitives`, `feat(i18n): next-intl ko/en`, `feat(ui): theme toggle`, `feat(ux): view transitions on post navigation`.

---

## 마일스톤 10 — 테스트 & 프로덕션 Docker

> **상세 sub-plan**: [./plans/M10-test-prod.md](./plans/M10-test-prod.md)

**목표:** Vitest 단위 테스트로 핵심 서버 로직을 검증하고, `Dockerfile.prod` 멀티 stage 빌드로 standalone 이미지를 만들어 `compose.prod.yml` 로 띄운다.

**DoD:**

- `pnpm test` 통과 (최소 6~10개 테스트 케이스).
- `docker compose -f compose.prod.yml up --build` 성공, 동일 시나리오(가입→로그인→글 작성) 동작.
- 빌드된 app 이미지 크기 < 300MB.

**Files:**

- Create: `Dockerfile.prod`, `compose.prod.yml`.
- Create: `src/app/api/health/route.ts` — `GET → 200 {status:'ok'}` (Docker HEALTHCHECK 용).
- Create: `tests/auth/jwt.test.ts`, `tests/auth/session.test.ts`, `tests/storage/presign.test.ts`, `tests/trpc/post.test.ts`.
- Modify: `vitest.config.ts` (정식 셋업).

### 작업 체크리스트

- [ ] **vitest.config.ts**:

  ```ts
  import { defineConfig } from "vitest/config";
  import react from "@vitejs/plugin-react";
  import path from "node:path";

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: "node",
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    },
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  });
  ```

- [ ] **tests/auth/jwt.test.ts**:
  - access 발급 → 검증 → payload 일치.
  - 만료된 토큰 검증 시 throw.
  - 다른 secret 으로 검증 시 throw.
- [ ] **tests/auth/session.test.ts** (in-memory pg-mem 또는 Postgres docker test 컨테이너):
  - 회전 후 기존 세션 revoked, 새 세션 활성.
  - 회전된 세션으로 재회전 시 user 전체 revoke (`detectReuse`).
- [ ] **tests/storage/presign.test.ts**:
  - kind 별 키 prefix 규칙.
  - 사이즈/MIME 위반 시 throw.
- [ ] **tests/trpc/post.test.ts**:
  - `createCaller` 로 user 컨텍스트 mock 후 create → bySlug 가 동일 데이터를 반환.
  - 비작성자 update 시 `FORBIDDEN`.
- [ ] **/api/health route**: 200 응답 텍스트.
- [ ] **Dockerfile.prod**:

  ```dockerfile
  # 1) deps
  FROM node:22-alpine AS deps
  WORKDIR /app
  RUN apk add --no-cache libc6-compat && corepack enable
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install --frozen-lockfile

  # 2) builder
  FROM node:22-alpine AS builder
  WORKDIR /app
  RUN corepack enable
  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  ENV NEXT_TELEMETRY_DISABLED=1
  RUN pnpm build

  # 3) runner
  FROM node:22-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  ENV NEXT_TELEMETRY_DISABLED=1
  RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
  COPY --from=builder /app/public ./public
  COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
  COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
  USER nextjs
  EXPOSE 3000
  ENV PORT=3000 HOSTNAME=0.0.0.0
  HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
  CMD ["node", "server.js"]
  ```

- [ ] **compose.prod.yml**: dev 와 같은 postgres/minio/mailpit + app 서비스(prod 이미지) + `restart: unless-stopped`. bind mount 없음.
- [ ] 빌드 검증: `docker compose -f compose.prod.yml build app` → `docker images` 로 크기 확인.
- [ ] 가동 검증: 동일 풀 시나리오 통과.
- [ ] 커밋: `test: auth/storage/trpc units`, `feat(health): /api/health endpoint`, `build(docker): production Dockerfile + compose`.

---

## 전 마일스톤 공통 작업 원칙

1. **TDD 가능 영역(M2, M3, M4, M5, M6, M7, M8, M10) 은 작은 단위로 실패 테스트 → 구현 → 통과 → 커밋**을 반복한다.
2. **한 PR = 한 마일스톤** 을 기본으로 하되, 큰 마일스톤(M3, M5)은 sub-PR 로 더 쪼개도 좋다.
3. **모든 새 파일·핵심 함수에 한국어 주석**(NFR-3). 단순 getter/setter 는 생략 가능.
4. **revalidate**: mutation 후 영향 받는 RSC 경로는 `revalidatePath` 로 명시.
5. **에러 처리**: tRPC `TRPCError` 코드를 명확히(`UNAUTHORIZED/FORBIDDEN/BAD_REQUEST/NOT_FOUND/CONFLICT`).
6. **로깅**: 서버 에러는 `console.error(JSON.stringify({event, error: serializeError(e)}))` 형태로 통일.
7. **시크릿 회전**: `.env` 의 JWT secrets 는 32자 이상 랜덤. README 에 `openssl rand -base64 48` 명시.

---

## 다음 마일스톤 sub-plan 작성 시 권장 템플릿

마일스톤 2 부터는 본격 시작 직전에 아래 형식의 sub-plan 을 `docs/plans/MX-<name>.md` 로 만들어 TDD step-by-step 으로 진행하길 권장한다.

```markdown
# MX <name> sub-plan

## Goal

## Files (Create/Modify/Test)

## Tasks

### Task 1

- [ ] Step 1.1 ... (실패 테스트)
- [ ] Step 1.2 ... (run; expect fail)
- [ ] Step 1.3 ... (구현)
- [ ] Step 1.4 ... (run; expect pass)
- [ ] Step 1.5 ... (commit)

## Verification
```

---

## 사용자 검증 절차 (마일스톤 종료 시점 체크리스트)

- [ ] `pnpm typecheck` 통과
- [ ] `pnpm lint` 통과
- [ ] `pnpm test` 통과 (M10 이후)
- [ ] 마일스톤 DoD 시나리오 수동 실행 성공
- [ ] 변경된 파일들에 한국어 주석 포함 여부 검토
- [ ] `git log --oneline` 로 커밋이 잘게 쪼개졌는지 확인

---

문서 끝.
