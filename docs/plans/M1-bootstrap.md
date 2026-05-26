# M1 — 부트스트랩 sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`. 모든 step 은 체크박스(`- [ ]`)로 추적.

**Goal:** Next.js 15 App Router(React 19) + TailwindCSS v4 + tRPC + TanStack Query + Drizzle + zod 스캐폴드를 `compose.dev.yml` 로 띄워, `http://localhost:3000` 의 빈 홈페이지와 `/api/trpc/health.ping` 이 응답하는 상태까지 만든다.

**Architecture:** 단일 Next.js 모놀리식. dev 는 Docker Compose 로 PostgreSQL · MinIO · Mailpit · app 컨테이너를 한 번에 띄우고, app 은 호스트 소스를 bind mount + named volume `node_modules` 패턴으로 핫리로드. tRPC 는 App Router 의 fetch 어댑터로 `/api/trpc/[trpc]` 에 마운트.

**Tech Stack:** Next.js 15+, React 19, TypeScript(strict), TailwindCSS v4, tRPC v11, TanStack Query v5, Drizzle 0.36+, zod, Docker Compose, pnpm 9.

---

## 사전 조건

- [ ] 호스트에 Node 22+, pnpm 9+, Docker Desktop 이 설치되어 있다.
- [ ] `D:\Study\NextJS\nextjs-tutorial` 디렉터리가 비어 있다 (또는 `docs/` 만 존재).

---

## 파일 구조

**Create (루트):**
- `.gitignore`, `.dockerignore`, `.env.example`
- `package.json`, `tsconfig.json`, `next.config.ts`
- `postcss.config.mjs`, `tailwind.config.ts`
- `drizzle.config.ts`, `components.json`
- `Dockerfile.dev`, `compose.dev.yml`

**Create (`src/`):**
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/app/api/trpc/[trpc]/route.ts`
- `src/components/providers.tsx`
- `src/lib/env.ts`
- `src/server/trpc/trpc.ts`, `context.ts`, `routers/_app.ts`, `routers/health.ts`
- `src/server/db/schema/.gitkeep`

**Test:** 이 마일스톤은 인프라 위주라 단위 테스트 없음. 검증은 수동 (브라우저 + `curl` + MinIO/Mailpit UI).

---

## 작업 단위 (Task) 분해

총 5 Task. 마지막에 한 커밋.

- **Task 1**: 무시 파일 + 패키지 매니페스트 + TypeScript 설정.
- **Task 2**: Next.js / Tailwind v4 / 환경변수 검증.
- **Task 3**: tRPC 서버 셋업 + 라우터 마운트.
- **Task 4**: 클라이언트 페이지/Provider + shadcn 메타 + Drizzle 설정.
- **Task 5**: Docker (Dockerfile.dev + compose.dev.yml) + 기동/검증/커밋.

---

## Task 1 — 무시 파일 + 패키지 매니페스트 + TS 설정

**Files:**
- Create: `.gitignore`, `.dockerignore`, `package.json`, `tsconfig.json`

### Steps

- [x] **1.1 `.gitignore`**

```gitignore
node_modules
.next
.turbo
.omc
dist
coverage
.env
.env.*.local
*.log
.DS_Store
.idea
.vscode
.pnpm-store
next-env.d.ts
```

- [x] **1.2 `.dockerignore`**

```dockerignore
node_modules
.next
.git
.turbo
coverage
Dockerfile*
compose*.yml
docs
.env
.env.*.local
```

- [x] **1.3 `package.json`**

```json
{
  "name": "nextjs-tutorial",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000 -H 0.0.0.0",
    "dev:turbo": "next dev --turbopack -p 3000 -H 0.0.0.0",
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

> Windows + Docker bind mount 핫리로드 호환을 위해 기본 `dev` 는 webpack. Turbopack 은 `dev:turbo` 에 보존.

- [x] **1.4 `tsconfig.json`**

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
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Task 2 — Next.js / Tailwind v4 / 환경변수 검증

**Files:**
- Create: `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`
- Create: `src/app/globals.css`
- Create: `src/lib/env.ts`
- Create: `.env.example`

### Steps

- [x] **2.1 `next.config.ts`**

```ts
import type { NextConfig } from "next";

// Next.js 설정 — 학습용으로 standalone 빌드를 켜 둔다.
const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "minio", port: "9000" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Windows 호스트 + Docker bind mount 조합에선 inotify 이벤트가 전달되지 않는다.
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
      ignored: ["**/node_modules", "**/.next", "**/.git"],
    };
    return config;
  },
};

export default nextConfig;
```

- [x] **2.2 `postcss.config.mjs`**

```js
// Tailwind v4 의 공식 PostCSS 플러그인.
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

- [x] **2.3 `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class", // next-themes 와 결합해 .dark 클래스로 다크모드 토글.
};

export default config;
```

- [x] **2.4 `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  color-scheme: light dark;
}

html,
body {
  height: 100%;
}
```

- [x] **2.5 `src/lib/env.ts`**

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

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
```

- [x] **2.6 `.env.example`**

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgres://postgres:postgres@postgres:5432/blog
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/blog

# 32 글자 이상 랜덤 문자열로 교체: openssl rand -base64 48
JWT_ACCESS_SECRET=change-me-please-change-me-please-32+
JWT_REFRESH_SECRET=change-me-please-change-me-please-32+
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000

S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=blog
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_PUBLIC_URL=http://localhost:9000

SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM="Blog <no-reply@blog.local>"

DEFAULT_LOCALE=ko
SUPPORTED_LOCALES=ko,en
```

---

## Task 3 — tRPC 서버 셋업 + 라우터 마운트

**Files:**
- Create: `src/server/trpc/trpc.ts`, `context.ts`
- Create: `src/server/trpc/routers/health.ts`, `routers/_app.ts`
- Create: `src/app/api/trpc/[trpc]/route.ts`

### Steps

- [x] **3.1 `src/server/trpc/trpc.ts`**

```ts
// tRPC 초기화 — context 와 transformer(superjson) 만 지정.
// superjson 은 Date/Map/Set 등을 손실 없이 직렬화한다.
// protectedProcedure 는 마일스톤 3 에서 추가.
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
```

- [x] **3.2 `src/server/trpc/context.ts`**

```ts
// HTTP 요청 → tRPC context 생성.
// 지금은 user 가 항상 null. 마일스톤 3 에서 쿠키의 access JWT 를 검증해 채운다.
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export function createContext(_opts: FetchCreateContextFnOptions) {
  return {
    user: null as null | { id: string; role: "USER" | "ADMIN" },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

- [x] **3.3 `src/server/trpc/routers/health.ts`**

```ts
// 부팅 검증용 라우터. 라우터 구조 학습 목적.
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  ping: publicProcedure.query(() => "pong" as const),
});
```

- [x] **3.4 `src/server/trpc/routers/_app.ts`**

```ts
// 모든 도메인 라우터를 합치는 루트 라우터.
import { router } from "../trpc";
import { healthRouter } from "./health";

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
```

- [x] **3.5 `src/app/api/trpc/[trpc]/route.ts`**

```ts
// App Router 에 fetch 어댑터로 tRPC 를 마운트.
// 단일 catch-all route 가 GET/POST 둘 다 처리한다.
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createContext(opts),
    onError({ error, path }) {
      console.error(`[tRPC] ${path ?? "<no-path>"}:`, error.message);
    },
  });

export { handler as GET, handler as POST };
```

---

## Task 4 — 클라이언트 페이지/Provider + shadcn 메타 + Drizzle 설정

**Files:**
- Create: `src/components/providers.tsx`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `drizzle.config.ts`, `src/server/db/schema/.gitkeep`
- Create: `components.json`

### Steps

- [x] **4.1 `src/components/providers.tsx`**

```tsx
"use client";
// 클라이언트 측 Provider 모음. 지금은 TanStack Query 만.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";

export function Providers({ children }: PropsWithChildren) {
  // 매 렌더마다 새 QueryClient 를 만들면 캐시가 전부 날아간다.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [x] **4.2 `src/app/layout.tsx`**

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
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [x] **4.3 `src/app/page.tsx`**

```tsx
// 부팅 검증용 홈페이지. 마일스톤 5 에서 진짜 피드로 교체.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">학습용 블로그 🚀</h1>
      <p className="text-sm text-zinc-500">
        부트스트랩이 정상 동작 중입니다. 다음 마일스톤은 DB 스키마(M2)입니다.
      </p>
    </main>
  );
}
```

- [x] **4.4 `drizzle.config.ts`**

```ts
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

- [x] **4.5 `src/server/db/schema/.gitkeep`** (스키마는 M2 에서 채움)

```
# 마일스톤 2 에서 users / sessions / tokens 스키마 파일이 이 디렉터리에 추가된다.
```

- [x] **4.6 `components.json`** (M9 의 shadcn add 명령이 이 파일을 읽음)

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

---

## Task 5 — Docker + 기동/검증/커밋

**Files:**
- Create: `Dockerfile.dev`, `compose.dev.yml`

### Steps

- [x] **5.1 `Dockerfile.dev`**

```dockerfile
# 개발용 컨테이너: 의존성만 미리 설치하고, 소스는 bind mount 로 갈아끼운다.
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat \
    && corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Windows bind mount 의 inotify 이슈 우회 — polling 모드.
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true

EXPOSE 3000
CMD ["pnpm", "dev"]
```

- [x] **5.2 `compose.dev.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: blog
    ports: ["5432:5432"]
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
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 10

  # 최초 부팅 시 'blog' 버킷 자동 생성.
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
    ports: ["1025:1025", "8025:8025"]

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/blog
      S3_ENDPOINT: http://minio:9000
      SMTP_HOST: mailpit
      # Windows bind mount 핫리로드 보장.
      WATCHPACK_POLLING: "true"
      WATCHPACK_POLLING_INTERVAL: "1000"
      CHOKIDAR_USEPOLLING: "true"
      CHOKIDAR_INTERVAL: "1000"
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - next_cache:/app/.next
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      minio: { condition: service_healthy }
      mailpit: { condition: service_started }

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
    ports: ["4983:4983"]
    depends_on:
      postgres: { condition: service_healthy }

volumes:
  pgdata:
  miniodata:
  node_modules:
  next_cache:
```

- [x] **5.3 IDE 가 타입을 인식하도록 호스트에 한 번 install**

```powershell
cd D:\Study\NextJS\nextjs-tutorial
pnpm install
```

> 컨테이너 안 `node_modules`(Linux 바이너리, named volume) 와 호스트 `node_modules`(Windows 바이너리, IDE 가 참조) 가 공존한다. `pnpm-lock.yaml` 도 이때 생성·커밋.

- [x] **5.4 `.env` 만들고 컨테이너 기동**

```powershell
Copy-Item .env.example .env
docker compose -f compose.dev.yml up --build
```

- [ ] **5.5 수동 검증**

| 항목 | 방법 |
|---|---|
| 홈 | `http://localhost:3000` → "학습용 블로그 🚀" |
| tRPC | `curl 'http://localhost:3000/api/trpc/health.ping?batch=1&input=%7B%220%22%3A%7B%7D%7D'` → `"pong"` 포함 |
| Mailpit | `http://localhost:8025` |
| MinIO Console | `http://localhost:9001` (`minioadmin` / `minioadmin`), `blog` 버킷 존재 |
| 핫리로드 | `src/app/page.tsx` 텍스트 수정·저장 → 브라우저 자동 반영 |

- [x] **5.6 커밋**

```bash
git init -b main
git add docs/
git commit -m "docs: add PRD and implementation plans"
git add .gitignore .dockerignore .env.example package.json tsconfig.json next.config.ts \
  postcss.config.mjs tailwind.config.ts drizzle.config.ts components.json \
  Dockerfile.dev compose.dev.yml src/
git commit -m "feat(bootstrap): Next.js 15 + Docker dev compose + tRPC health"
git add pnpm-lock.yaml package.json next.config.ts compose.dev.yml
git commit -m "fix(dev): webpack polling for Windows bind mount hot reload"
```

---

## 마일스톤 종료 체크리스트

- [x] `docker compose -f compose.dev.yml up` 으로 5개 컨테이너 healthy.
- [x] `http://localhost:3000` 정상 노출.
- [x] tRPC `health.ping` 정상 응답.
- [ ] 핫리로드 동작 (`src/app/page.tsx` 수정 → 자동 반영).
- [x] `git log --oneline` 에 docs / bootstrap / dev-fix 커밋 3개.

---

## 다음 단계

이 마일스톤이 완료되면 **M2 — DB 스키마 v1** (`docs/plans/M2-db-schema.md`) 로 진행. M2 는 `users`, `sessions`, `email_verifications`, `password_resets` 4개 테이블을 Drizzle 로 정의하고 Vitest 통합 테스트로 검증한다.

---

문서 끝.
