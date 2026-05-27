# M10 — 테스트 & 프로덕션 Docker sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.

**Goal:** Vitest 단위 테스트 셋트로 인증/세션/저장소/tRPC 핵심을 검증. 멀티 stage `Dockerfile.prod` 로 `output: standalone` 이미지를 빌드해 `compose.prod.yml` 로 prod 시나리오 동작 확인. 이미지 크기 < 300MB.

**Architecture:** Vitest 는 `tests/setup.ts` 에서 `.env` 로딩 + `TEST_DATABASE_URL` override. Postgres 컨테이너에 직접 붙음(통합 테스트). Prod 이미지는 deps → builder → runner 3 stage. runner 는 비루트 사용자, `.next/standalone` 만 복사. `/api/health` 가 HEALTHCHECK 대상.

**Tech Stack:** Vitest 2+, Docker 멀티 stage, Next.js `output: 'standalone'`.

---

## 사전 조건

- [x] M1~M9 완료.
- [x] `compose.dev.yml` 의 postgres 가 5432 를 호스트에 노출.
- [x] `TEST_DATABASE_URL` 이 `.env` 에 설정됨 (M2 에서 함).
- [x] M1~M3 에 이미 작성된 일부 테스트(password / jwt / session / db schema / presign)가 그대로 동작.

---

## 파일 구조

**Create:**
- `src/app/api/health/route.ts`
- `Dockerfile.prod`
- `compose.prod.yml`
- `tests/trpc/post.test.ts` — `createCaller` 로 글 라우터 핵심 procedure
- `tests/trpc/comment.test.ts` — 댓글 권한 / 1단계 검증
- (선택) `tests/auth/refresh.test.ts` — refresh 회전 흐름

**Modify:**
- `vitest.config.ts` — `fileParallelism: false`, env load, alias 등 정합성 점검
- `package.json` — `start:prod` 같은 스크립트 보완
- `.dockerignore` — prod 빌드 포함 안 될 파일 점검

---

## 작업 단위 (Task) 분해

총 6 Task.

- Task 1: `/api/health` Route Handler
- Task 2: 추가 Vitest — post / comment / refresh
- Task 3: `Dockerfile.prod` (deps/builder/runner)
- Task 4: `compose.prod.yml`
- Task 5: 빌드 + 이미지 크기 검증
- Task 6: prod 동작 시나리오 검증 + 커밋

---

## Task 1 — `/api/health` Route Handler

**Files:** `src/app/api/health/route.ts`

### Steps

- [x] **1.1 route.ts**

```ts
// Docker HEALTHCHECK 용. DB 핑까지 포함해도 좋지만 학습 단순화로 200 만.
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", at: new Date().toISOString() });
}
```

- [x] **1.2 검증/커밋**

```bash
curl http://localhost:3000/api/health
git add src/app/api/health/route.ts
git commit -m "feat(health): /api/health endpoint for docker healthcheck"
```

---

## Task 2 — 추가 Vitest

**Files:** `tests/trpc/post.test.ts`, `tests/trpc/comment.test.ts`, (선택) `tests/auth/refresh.test.ts`, `tests/setup.ts`(점검)

### Steps

- [x] **2.1 헬퍼: createCaller 로 user context mock**

```ts
// tests/helpers/caller.ts
import { appRouter } from "@/server/trpc/routers/_app";

export function callerForUser(userId: string, role: "USER" | "ADMIN" = "USER") {
  return appRouter.createCaller({ user: { id: userId, role } });
}
export function publicCaller() {
  return appRouter.createCaller({ user: null });
}
```

- [x] **2.2 post.test.ts**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { callerForUser, publicCaller } from "../helpers/caller";

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE post_tags, attachments, comments, likes, bookmarks, posts, tags, categories, sessions, email_verifications, password_resets, users RESTART IDENTITY CASCADE`);
}

async function seedUser() {
  const [u] = await db.insert(users).values({
    email: "a@example.com", passwordHash: "x", nickname: "a",
  }).returning({ id: users.id });
  return u!;
}

const minimalDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] };

describe("post router", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("create → bySlug 동일 데이터", async () => {
    const u = await seedUser();
    const c = callerForUser(u.id);
    const { slug } = await c.post.create({
      title: "첫 글", contentJson: minimalDoc,
      categorySlug: null, tagSlugs: ["devlog"], isPublished: true,
      attachmentKeys: [],
    });
    const got = await c.post.bySlug({ slug });
    expect(got.title).toBe("첫 글");
    expect(got.tags.map((t) => t.slug)).toContain("devlog");
  });

  it("비작성자 update 시 FORBIDDEN", async () => {
    const u1 = await seedUser();
    const [u2] = await db.insert(users).values({
      email: "b@example.com", passwordHash: "x", nickname: "b",
    }).returning({ id: users.id });
    const c1 = callerForUser(u1.id);
    const { id } = await c1.post.create({
      title: "x", contentJson: minimalDoc, categorySlug: null, tagSlugs: [], isPublished: true, attachmentKeys: [],
    });
    const c2 = callerForUser(u2!.id);
    await expect(
      c2.post.update({
        id, title: "y", contentJson: minimalDoc, categorySlug: null, tagSlugs: [], isPublished: true, attachmentKeys: [],
      }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("public 은 숨김 글 NOT_FOUND", async () => {
    const u = await seedUser();
    const c = callerForUser(u.id);
    const { slug, id } = await c.post.create({
      title: "비밀", contentJson: minimalDoc, categorySlug: null, tagSlugs: [], isPublished: true, attachmentKeys: [],
    });
    await db.execute(sql`UPDATE posts SET is_hidden = true WHERE id = ${id}`);
    const guest = publicCaller();
    await expect(guest.post.bySlug({ slug })).rejects.toThrow(/NOT_FOUND/);
    // 작성자는 여전히 조회 가능.
    await expect(c.post.bySlug({ slug })).resolves.toBeTruthy();
  });
});
```

- [x] **2.3 comment.test.ts**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { callerForUser } from "../helpers/caller";

const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] };

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE post_tags, comments, likes, bookmarks, attachments, posts, tags, categories, sessions, email_verifications, password_resets, users RESTART IDENTITY CASCADE`);
}

describe("comment router", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("대댓글 1단계 제한", async () => {
    const [u] = await db.insert(users).values({ email: "u@x", passwordHash: "x", nickname: "u" }).returning({ id: users.id });
    const c = callerForUser(u!.id);
    const { id: postId } = await c.post.create({ title: "p", contentJson: doc, categorySlug: null, tagSlugs: [], isPublished: true, attachmentKeys: [] });
    const root = await c.comment.create({ postId, content: "1" });
    const child = await c.comment.create({ postId, parentId: root.id, content: "2" });
    await expect(c.comment.create({ postId, parentId: child.id, content: "3" })).rejects.toThrow(/1단계/);
  });

  it("작성자만 삭제 가능", async () => {
    const [u1] = await db.insert(users).values({ email: "1@x", passwordHash: "x", nickname: "1" }).returning({ id: users.id });
    const [u2] = await db.insert(users).values({ email: "2@x", passwordHash: "x", nickname: "2" }).returning({ id: users.id });
    const c1 = callerForUser(u1!.id);
    const c2 = callerForUser(u2!.id);
    const { id: postId } = await c1.post.create({ title: "p", contentJson: doc, categorySlug: null, tagSlugs: [], isPublished: true, attachmentKeys: [] });
    const created = await c1.comment.create({ postId, content: "hi" });
    await expect(c2.comment.delete({ id: created.id })).rejects.toThrow(/FORBIDDEN/);
    await expect(c1.comment.delete({ id: created.id })).resolves.toEqual({ ok: true });
  });
});
```

- [x] **2.4 (선택) refresh 회전 테스트**

```ts
// tests/auth/refresh.test.ts
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { createSession, rotateSession } from "@/server/auth/session";

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE sessions, email_verifications, password_resets, users RESTART IDENTITY CASCADE`);
}

describe("refresh rotation", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("정상 회전 → 새 토큰 + 기존 revoke", async () => {
    const [u] = await db.insert(users).values({ email: "r@x", passwordHash: "x", nickname: "r" }).returning({ id: users.id, role: users.role });
    const a = await createSession({ userId: u!.id, role: u!.role });
    const b = await rotateSession(a.refresh);
    expect(b.sessionId).not.toBe(a.sessionId);
  });
});
```

- [x] **2.5 실행 + 커밋**

```bash
pnpm test
git add tests/
git commit -m "test: post/comment routers + refresh rotation"
```

---

## Task 3 — `Dockerfile.prod`

**Files:** `Dockerfile.prod`

### Steps

- [x] **3.1 Dockerfile.prod**

```dockerfile
# 1) deps — 의존성 캐시 레이어
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2) builder — 빌드만
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 학습 포인트: standalone 출력은 next.config.ts 의 output: 'standalone' 에 의존.
RUN pnpm build

# 3) runner — 슬림 + 비루트
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

- [x] **3.2 `.dockerignore` 점검**

`node_modules`, `.next`, `.git`, `tests`, `docs`, `coverage`, `Dockerfile*`, `compose*.yml`, `.env`, `.env.*.local`, `.omc` 가 들어있는지 확인. (현재 dev 용으로 작성된 것 그대로 OK)

- [x] **3.3 커밋**

```bash
git add Dockerfile.prod .dockerignore
git commit -m "build(docker): production multi-stage Dockerfile"
```

---

## Task 4 — `compose.prod.yml`

**Files:** `compose.prod.yml`

### Steps

- [x] **4.1 compose.prod.yml**

```yaml
# 프로덕션 시뮬레이션 — bind mount 없음, restart:unless-stopped.
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: blog
    volumes:
      - pgdata_prod:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - miniodata_prod:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      (mc mb local/blog || true) &&
      mc anonymous set download local/blog &&
      mc admin config set local api cors_allow_origin='*' &&
      mc admin service restart local;
      "
    restart: "no"

  mailpit:
    image: axllent/mailpit:latest
    ports: ["1025:1025", "8025:8025"]
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/blog
      S3_ENDPOINT: http://minio:9000
      SMTP_HOST: mailpit
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      minio: { condition: service_healthy }
      mailpit: { condition: service_started }
    restart: unless-stopped

  # 프로덕션 시뮬레이션에서도 마이그레이션을 한 번 적용해야 한다.
  # 학습 단순화: app 부팅 전에 별도 1회성 서비스로.
  migrate:
    build:
      context: .
      dockerfile: Dockerfile.dev   # dev 이미지에는 drizzle-kit 이 있어 db:migrate 가능
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/blog
    command: ["pnpm", "db:migrate"]
    depends_on:
      postgres: { condition: service_healthy }
    restart: "no"

volumes:
  pgdata_prod:
  miniodata_prod:
```

- [x] **4.2 커밋**

```bash
git add compose.prod.yml
git commit -m "build(docker): production compose with migrate one-shot"
```

---

## Task 5 — 빌드 + 이미지 크기 검증

### Steps

- [x] **5.1 prod 이미지 빌드**

```bash
docker compose -f compose.prod.yml build app
docker images | findstr nextjs-tutorial
# 또는 PowerShell: docker images | Select-String nextjs-tutorial
```

목표: 300MB 미만.

- [x] **5.2 결과가 크다면 점검 포인트**
- `node_modules` 가 runner stage 에 안 들어가는지 (`.next/standalone` 만 사용).
- `public/` 폴더의 큰 파일 (이 프로젝트는 거의 비어있음 — OK).
- 추가 dev deps 가 dependencies 에 잘못 들어가지 않았는지 (`package.json` 점검).

---

## Task 6 — 풀 시나리오 검증 + 커밋

### Steps

- [ ] **6.1 기동**

```bash
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml ps
```

- [ ] **6.2 시나리오**

1. http://localhost:3000 → 홈 노출.
2. 회원가입 → Mailpit 메일 인증 → 로그인 → 글 작성(첨부) → 댓글 / 좋아요 / 북마크.
3. 검색 / 무한 스크롤.
4. ADMIN 시드 계정 (별도로 seed-admin 컨테이너 1회 돌리거나 dev 에서 한 번) 으로 admin 페이지 동작.
5. `docker stats` 로 메모리 / CPU 사용 관찰.

> dev 와 prod 가 같은 postgres / minio 볼륨을 공유하면 안 된다. `compose.prod.yml` 의 named volume 이름이 `pgdata_prod`, `miniodata_prod` 로 분리되어 있어 OK.

- [x] **6.3 커밋**

```bash
git add docs/
git commit -m "docs(milestone10): test + prod docker completion notes"
```

(필요 시 학습 메모를 IMPLEMENTATION_PLAN.md 에 추가하고 함께 커밋.)

---

## 마일스톤 종료 체크리스트

- [x] `pnpm test` 전체 통과 (password / jwt / session / schema / presign / post / comment).
- [ ] `docker compose -f compose.prod.yml up --build` 정상 기동.
- [ ] `/api/health` HEALTHCHECK 통과 (`docker compose ps` 의 상태가 `healthy`).
- [ ] 풀 시나리오(가입→로그인→글→댓글→좋아요→검색) 동작.
- [ ] 이미지 크기 < 300MB. (실측 351MB — 목표 살짝 초과. node_modules 트리밍 / distroless 베이스로 추후 최적화 여지)

---

## 마지막 마무리

이 마일스톤을 통과하면 PRD 의 1차 범위가 모두 완료된다. PRD §18 의 2차 후보(E2E, 댓글 다단계, 알림, PPR 실험 등) 는 향후 별도 sub-plan 으로 다루면 된다.

---

문서 끝.
