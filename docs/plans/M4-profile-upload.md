# M4 — 프로필 + MinIO Presigned 업로드 sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.

**Goal:** 로그인한 사용자가 `/me` 에서 닉네임/소개를 수정하고, 아바타 이미지를 **presigned PUT 으로 MinIO 에 직접 업로드**한다. 서버는 presigned URL 만 발급하고 바이너리를 거치지 않는다. 업로드 완료 후 `confirmAvatar` mutation 으로 `attachments` row 등록 + `users.avatar_key` 갱신 + RSC 무효화.

**Architecture:** S3-호환 클라이언트(`@aws-sdk/client-s3`)를 MinIO 에 `forcePathStyle: true` 로 연결. presigned URL TTL 은 5분. 업로드 종류별(AVATAR / POST_INLINE / POST_ATTACHMENT) 화이트리스트 검증(MIME + 사이즈). 다운로드는 (개발용으로) `blog` 버킷을 익명 다운로드 허용으로 두므로 `S3_PUBLIC_URL/{bucket}/{key}` 로 직접 접근.

**Tech Stack:** @aws-sdk/client-s3 3.6x, @aws-sdk/s3-request-presigner 3.6x.

---

## 사전 조건

- [ ] M1~M3 완료. `getCurrentUser`, `protectedProcedure` 사용 가능.
- [ ] MinIO 컨테이너 동작 + `blog` 버킷 존재 + `mc anonymous set download local/blog` 적용됨 (M1 `minio-init` 산출물).
- [ ] MinIO CORS: 브라우저 → MinIO PUT 을 허용하도록 dev 컨테이너 초기화에서 `mc admin config set local api cors_allow_origin="*"` 가 적용되어 있어야 한다 (없으면 step 1.x 에서 추가).

---

## 파일 구조

**Create:**
- `src/server/db/schema/attachments.ts` — attachments 테이블 + enum
- `src/server/db/schema/index.ts` 갱신
- `src/server/db/migrations/*` — drizzle-kit 산출물
- `src/server/storage/s3.ts` — S3 client
- `src/server/storage/presign.ts` — keyFor / requestUpload / presignedGet
- `src/server/storage/constraints.ts` — kind 별 MIME/사이즈 화이트리스트
- `src/server/trpc/routers/profile.ts`
- `src/components/profile/profile-form.tsx`
- `src/components/profile/avatar-uploader.tsx`
- `src/app/[locale]/(main)/me/page.tsx`
- `src/server/actions/profile.ts` — `updateProfileAction`

**Modify:**
- `src/server/trpc/routers/_app.ts` — profile 라우터 등록
- `compose.dev.yml` — `minio-init` 의 entrypoint 에 CORS 설정 한 줄 추가 (안 되어 있을 경우)

**Test:**
- `tests/storage/presign.test.ts` — keyFor 규칙, 화이트리스트 위반 시 throw

**Add deps:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

---

## 작업 단위 (Task) 분해

총 6 Task.

- Task 1: attachments 스키마 + 마이그레이션
- Task 2: MinIO CORS 보정 + S3 client + constraints
- Task 3: presign 로직 + Vitest 테스트
- Task 4: profile tRPC 라우터 + updateProfileAction
- Task 5: 프로필 페이지 + ProfileForm + AvatarUploader
- Task 6: 수동 검증 + 커밋 정리

---

## Task 1 — attachments 스키마 + 마이그레이션

**Files:** `src/server/db/schema/_enums.ts`(modify), `src/server/db/schema/attachments.ts`, `src/server/db/schema/index.ts`(modify)

### Steps

- [ ] **1.1 enum 추가**

`src/server/db/schema/_enums.ts`
```ts
import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const attachmentKindEnum = pgEnum("attachment_kind", [
  "AVATAR",
  "POST_INLINE",
  "POST_ATTACHMENT",
]);
```

- [ ] **1.2 attachments 스키마**

`src/server/db/schema/attachments.ts`
```ts
// 업로드된 객체의 메타데이터.
// post_id 는 NULL 가능 — AVATAR 또는 글 작성 중 인라인 업로드(아직 post 가 없음) 케이스.
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { attachmentKindEnum } from "./_enums";
import { users } from "./users";

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // post_id 는 M5 에서 posts 테이블 생긴 뒤 references 로 연결한다.
    // 지금은 단순 uuid 컬럼으로 두고, M5 에서 ALTER 마이그레이션으로 FK 추가.
    postId: uuid("post_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    kind: attachmentKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    ownerIdx: index("attachments_owner_id_idx").on(t.ownerId),
    postIdx: index("attachments_post_id_idx").on(t.postId),
    keyUnique: index("attachments_object_key_unique").on(t.objectKey),
  }),
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
```

- [ ] **1.3 index.ts 갱신**

```ts
export * from "./_enums";
export * from "./users";
export * from "./sessions";
export * from "./tokens";
export * from "./attachments";
```

- [ ] **1.4 마이그레이션 생성/적용/검증/커밋**

```bash
docker compose -f compose.dev.yml exec app pnpm db:generate
docker compose -f compose.dev.yml exec app pnpm db:migrate
docker compose -f compose.dev.yml exec postgres psql -U postgres -d blog -c "\d attachments"

git add src/server/db/schema/_enums.ts src/server/db/schema/attachments.ts \
  src/server/db/schema/index.ts src/server/db/migrations/*
git commit -m "feat(db): attachments table with kind enum"
```

---

## Task 2 — MinIO CORS 보정 + S3 client + constraints

**Files:** `compose.dev.yml`(modify), `src/server/storage/s3.ts`, `src/server/storage/constraints.ts`

### Steps

- [ ] **2.1 MinIO CORS — `compose.dev.yml` 의 `minio-init` entrypoint 확장**

```yaml
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
```

> `mc admin service restart local` 가 한 번 일어나므로, 정책이 적용되려면 컨테이너 재기동 필요.

- [ ] **2.2 deps 설치**

```bash
docker compose -f compose.dev.yml exec app pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm install
```

- [ ] **2.3 s3.ts**

```ts
// S3-호환 클라이언트. MinIO 는 path-style 만 지원하므로 forcePathStyle: true.
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

// 객체 키를 외부 공개 URL 로 변환.
// dev 에선 minio 가 익명 다운로드 허용이라 그대로 접근 가능.
export function publicUrl(objectKey: string) {
  return `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/${objectKey}`;
}
```

- [ ] **2.4 constraints.ts**

```ts
// kind 별 허용 MIME / 최대 사이즈.
// 학습 차원에서 클라이언트·서버 양쪽에서 동일 화이트리스트를 사용한다.
export const UPLOAD_CONSTRAINTS = {
  AVATAR: {
    maxBytes: 2 * 1024 * 1024,
    mimeWhitelist: new Set(["image/jpeg", "image/png", "image/webp"]),
  },
  POST_INLINE: {
    maxBytes: 5 * 1024 * 1024,
    mimeWhitelist: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  },
  POST_ATTACHMENT: {
    maxBytes: 20 * 1024 * 1024,
    mimeWhitelist: new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "application/pdf",
      "application/zip",
      "text/plain", "text/csv", "text/markdown",
      "application/json",
    ]),
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_CONSTRAINTS;
```

- [ ] **2.5 커밋**

```bash
git add compose.dev.yml src/server/storage/s3.ts src/server/storage/constraints.ts package.json pnpm-lock.yaml
git commit -m "feat(storage): s3 client + upload kind constraints + minio CORS"
```

---

## Task 3 — presign 로직 + Vitest

**Files:** `src/server/storage/presign.ts`, `tests/storage/presign.test.ts`

### Steps

- [ ] **3.1 presign.ts**

```ts
// presigned URL 발급 도우미.
// 학습 포인트:
//  - 키 prefix 를 kind 별로 다르게 두어 GC/정책 적용이 쉽도록 한다.
//  - TTL 은 5분 — 발급 후 빠르게 업로드되어야 한다.
import { randomUUID } from "node:crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { env } from "@/lib/env";
import { s3 } from "./s3";
import { UPLOAD_CONSTRAINTS, type UploadKind } from "./constraints";

const PREFIX: Record<UploadKind, string> = {
  AVATAR: "avatars",
  POST_INLINE: "posts/inline",
  POST_ATTACHMENT: "posts/files",
};

function extFromMime(mime: string) {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "application/pdf": return "pdf";
    case "application/zip": return "zip";
    case "text/plain": return "txt";
    case "text/csv": return "csv";
    case "text/markdown": return "md";
    case "application/json": return "json";
    default: return "bin";
  }
}

export function keyFor(kind: UploadKind, mime: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${PREFIX[kind]}/${yyyy}/${mm}/${randomUUID()}.${extFromMime(mime)}`;
}

export async function requestUpload(p: {
  kind: UploadKind;
  mime: string;
  sizeBytes: number;
}) {
  const c = UPLOAD_CONSTRAINTS[p.kind];
  if (!c.mimeWhitelist.has(p.mime)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "허용되지 않는 파일 형식입니다." });
  }
  if (p.sizeBytes <= 0 || p.sizeBytes > c.maxBytes) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `파일 크기는 ${(c.maxBytes / 1024 / 1024).toFixed(0)}MB 이하여야 합니다.`,
    });
  }
  const objectKey = keyFor(p.kind, p.mime);
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: objectKey,
    ContentType: p.mime,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  return {
    uploadUrl,
    objectKey,
    headers: { "Content-Type": p.mime } as Record<string, string>,
  };
}

/** 비공개 객체용 — 본 프로젝트는 공개 다운로드라 사용 빈도 낮지만 학습용으로 남긴다. */
export async function presignedGet(objectKey: string) {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey });
  return getSignedUrl(s3, command, { expiresIn: 60 });
}
```

- [ ] **3.2 tests/storage/presign.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { keyFor, requestUpload } from "@/server/storage/presign";

describe("presign", () => {
  it("AVATAR 키 prefix 는 'avatars/'", () => {
    const k = keyFor("AVATAR", "image/png");
    expect(k.startsWith("avatars/")).toBe(true);
    expect(k.endsWith(".png")).toBe(true);
  });

  it("화이트리스트에 없는 MIME 은 throw", async () => {
    await expect(
      requestUpload({ kind: "AVATAR", mime: "application/x-msdownload", sizeBytes: 1000 }),
    ).rejects.toThrow(/허용되지 않/);
  });

  it("사이즈 한도 초과 시 throw", async () => {
    await expect(
      requestUpload({ kind: "AVATAR", mime: "image/png", sizeBytes: 10 * 1024 * 1024 }),
    ).rejects.toThrow(/MB 이하/);
  });

  it("정상 요청은 uploadUrl 과 objectKey 반환", async () => {
    const r = await requestUpload({ kind: "AVATAR", mime: "image/png", sizeBytes: 1024 });
    expect(r.uploadUrl).toMatch(/^http/);
    expect(r.objectKey.startsWith("avatars/")).toBe(true);
    expect(r.headers["Content-Type"]).toBe("image/png");
  });
});
```

- [ ] **3.3 커밋**

```bash
pnpm test tests/storage/presign.test.ts
git add src/server/storage/presign.ts tests/storage/presign.test.ts
git commit -m "feat(storage): presigned PUT issuance with whitelist validation"
```

---

## Task 4 — profile tRPC 라우터 + updateProfileAction

**Files:** `src/server/trpc/routers/profile.ts`, `src/server/trpc/routers/_app.ts`(modify), `src/server/actions/profile.ts`

### Steps

- [ ] **4.1 profile 라우터**

```ts
// src/server/trpc/routers/profile.ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/server/db/client";
import { attachments, users } from "@/server/db/schema";
import { requestUpload } from "@/server/storage/presign";
import { publicUrl } from "@/server/storage/s3";
import { UPLOAD_CONSTRAINTS } from "@/server/storage/constraints";

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [u] = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        bio: users.bio,
        avatarKey: users.avatarKey,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!u) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      ...u,
      avatarUrl: u.avatarKey ? publicUrl(u.avatarKey) : null,
    };
  }),

  update: protectedProcedure
    .input(z.object({
      nickname: z.string().min(2).max(20),
      bio: z.string().max(200).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(users)
        .set({ nickname: input.nickname, bio: input.bio, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id));
      return { ok: true as const };
    }),

  requestAvatarUpload: protectedProcedure
    .input(z.object({
      mime: z.string(),
      sizeBytes: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      return requestUpload({ kind: "AVATAR", mime: input.mime, sizeBytes: input.sizeBytes });
    }),

  confirmAvatar: protectedProcedure
    .input(z.object({
      objectKey: z.string().min(1),
      originalName: z.string().min(1).max(255),
      mime: z.string(),
      sizeBytes: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = UPLOAD_CONSTRAINTS.AVATAR;
      if (!c.mimeWhitelist.has(input.mime) || input.sizeBytes > c.maxBytes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "허용되지 않는 파일입니다." });
      }
      // attachments row + users.avatar_key 갱신을 한 트랜잭션으로.
      await db.transaction(async (tx) => {
        await tx.insert(attachments).values({
          ownerId: ctx.user.id,
          objectKey: input.objectKey,
          originalName: input.originalName,
          mimeType: input.mime,
          sizeBytes: input.sizeBytes,
          kind: "AVATAR",
        });
        await tx
          .update(users)
          .set({ avatarKey: input.objectKey, updatedAt: new Date() })
          .where(eq(users.id, ctx.user.id));
      });
      return { ok: true as const, avatarUrl: publicUrl(input.objectKey) };
    }),
});
```

- [ ] **4.2 `_app.ts` 갱신**

```ts
import { router } from "../trpc";
import { healthRouter } from "./health";
import { profileRouter } from "./profile";

export const appRouter = router({
  health: healthRouter,
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **4.3 updateProfileAction (서버 액션 폼용)**

```ts
// src/server/actions/profile.ts
"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/current-user";
import type { ActionState } from "./auth";

const UpdateProfileInput = z.object({
  nickname: z.string().min(2).max(20),
  bio: z.string().max(200).optional(),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsed = UpdateProfileInput.safeParse({
    nickname: formData.get("nickname"),
    bio: formData.get("bio") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };

  await db
    .update(users)
    .set({
      nickname: parsed.data.nickname,
      bio: parsed.data.bio ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, me.id));

  revalidatePath("/me");
  return { ok: true, message: "저장되었습니다." };
}
```

- [ ] **4.4 커밋**

```bash
git add src/server/trpc/routers/profile.ts src/server/trpc/routers/_app.ts src/server/actions/profile.ts
git commit -m "feat(profile): trpc router + updateProfile server action"
```

---

## Task 5 — 프로필 페이지 + ProfileForm + AvatarUploader

**Files:** `src/app/[locale]/(main)/me/page.tsx`, `src/components/profile/profile-form.tsx`, `src/components/profile/avatar-uploader.tsx`, `src/lib/trpc-client.ts`(있다면 활용)

### Steps

- [ ] **5.1 트RPC 클라이언트 셋업 — `src/lib/trpc-client.ts`** (이전 마일스톤에서 안 만들었다면 지금)

```ts
"use client";
// 클라이언트에서 사용할 tRPC react-query 통합.
// 학습 포인트: links 의 superjson transformer 는 서버와 반드시 일치해야 한다.
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/trpc/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

export function trpcLinks() {
  return [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // 쿠키 동봉 — same-origin 이라 별도 설정 없이 자동.
      fetch(input, init) {
        return fetch(input, { ...init, credentials: "include" });
      },
    }),
  ];
}
```

`src/components/providers.tsx` 갱신:
```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { trpc, trpcLinks } from "@/lib/trpc-client";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );
  const [trpcClient] = useState(() => trpc.createClient({ links: trpcLinks() }));
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **5.2 ProfileForm (Server Action 폼)**

```tsx
// src/components/profile/profile-form.tsx
"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction } from "@/server/actions/profile";
import type { ActionState } from "@/server/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
      {pending ? "저장 중..." : "저장"}
    </button>
  );
}

export function ProfileForm({ initial }: { initial: { nickname: string; bio: string | null } }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfileAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm">닉네임
        <input name="nickname" defaultValue={initial.nickname} required minLength={2} maxLength={20}
          className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="text-sm">한 줄 소개
        <textarea name="bio" defaultValue={initial.bio ?? ""} maxLength={200}
          className="mt-1 w-full rounded border px-3 py-2" rows={3} />
      </label>
      <div className="flex items-center gap-3">
        <Submit />
        {state && (
          <span className={state.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
```

- [ ] **5.3 AvatarUploader (presigned PUT 직접 업로드)**

```tsx
// src/components/profile/avatar-uploader.tsx
"use client";
// 1) tRPC requestAvatarUpload 로 presigned URL 받기
// 2) 받은 URL 로 브라우저가 MinIO 에 PUT
// 3) tRPC confirmAvatar 로 attachments INSERT + users.avatar_key 갱신
// 4) router.refresh() 로 RSC 재실행 → 새 아바타 노출
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { trpc } from "@/lib/trpc-client";
import { UPLOAD_CONSTRAINTS } from "@/server/storage/constraints";

export function AvatarUploader({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const requestUpload = trpc.profile.requestAvatarUpload.useMutation();
  const confirmAvatar = trpc.profile.confirmAvatar.useMutation();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const c = UPLOAD_CONSTRAINTS.AVATAR;
    if (!c.mimeWhitelist.has(file.type)) return setError("jpg/png/webp 만 업로드 가능합니다.");
    if (file.size > c.maxBytes) return setError("2MB 이하 파일만 가능합니다.");

    setUploading(true);
    try {
      const { uploadUrl, objectKey, headers } = await requestUpload.mutateAsync({
        mime: file.type, sizeBytes: file.size,
      });
      const res = await fetch(uploadUrl, { method: "PUT", headers, body: file });
      if (!res.ok) throw new Error(`업로드 실패 (${res.status})`);
      const { avatarUrl } = await confirmAvatar.mutateAsync({
        objectKey, originalName: file.name, mime: file.type, sizeBytes: file.size,
      });
      setPreviewUrl(avatarUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="size-20 overflow-hidden rounded-full border bg-zinc-100">
        {previewUrl ? (
          <Image src={previewUrl} alt="avatar" width={80} height={80} unoptimized
            className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-zinc-400">No Image</div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer rounded border px-3 py-1 text-sm">
          {uploading ? "업로드 중..." : "이미지 선택"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={onChange} disabled={uploading} />
        </label>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
```

- [ ] **5.4 `/me` 페이지 (RSC)**

```tsx
// src/app/[locale]/(main)/me/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { publicUrl } from "@/server/storage/s3";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function MePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/ko/sign-in");
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">내 프로필</h1>
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">아바타</h2>
        <AvatarUploader initialUrl={me.avatarKey ? publicUrl(me.avatarKey) : null} />
      </section>
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">기본 정보</h2>
        <ProfileForm initial={{ nickname: me.nickname, bio: null }} />
        {/* bio 는 users 스키마에 있지만 getCurrentUser 가 안 가져옴 → 필요시 select 확장 */}
      </section>
      <SignOutButton />
    </main>
  );
}
```

> `getCurrentUser` 가 bio 를 안 가져오니, 이 페이지에서는 `db` 로 직접 한 번 더 조회하거나 `getCurrentUser` 의 select 에 `bio` 를 추가하는 게 더 깔끔. (학습 차원에서 양쪽 다 시도해보길 권장.)

- [ ] **5.5 커밋**

```bash
git add src/components/profile/ src/app/\[locale\]/\(main\)/me/page.tsx src/lib/trpc-client.ts src/components/providers.tsx
git commit -m "feat(profile): /me page + ProfileForm + AvatarUploader with presigned PUT"
```

---

## Task 6 — 수동 검증

### Steps

- [ ] **6.1 풀 흐름 시나리오**

1. 로그인 (M3 의 회원가입·인증 거친 계정).
2. `/ko/me` 접근.
3. 아바타 이미지 (jpg/png/webp, < 2MB) 선택.
4. 네트워크 탭에서 `PUT http://localhost:9000/blog/avatars/...` 요청 성공 확인.
5. 페이지가 자동 새로고침(`router.refresh()`) 되고 새 아바타 노출.
6. MinIO 콘솔 (`http://localhost:9001`) → `blog` 버킷 → `avatars/YYYY/MM/...` 객체 확인.
7. 닉네임/소개 수정 후 "저장됨" 메시지.
8. drizzle-studio (`pnpm db:studio`) → `attachments` 테이블에 새 row, `users.avatar_key` 갱신 확인.

- [ ] **6.2 예외 시나리오**

- 4MB png → 클라이언트에서 즉시 거절 (서버까지 안 감).
- exe 파일 확장자만 jpg 로 바꿔 업로드 → 서버 confirm 단계에서 MIME 화이트리스트로 거절(브라우저가 정확한 MIME 을 보내므로 보통은 통과 안 됨; 추가 보안은 magic byte 검증, M4 범위 밖).

---

## 마일스톤 종료 체크리스트

- [ ] `pnpm test tests/storage/presign.test.ts` 통과.
- [ ] DB: `attachments` 4개 인덱스 존재, `users.avatar_key` nullable.
- [ ] MinIO 콘솔에서 업로드된 객체 확인.
- [ ] 모든 새 파일에 한국어 주석.

---

## 다음 단계

**M5 — 글 도메인 (Tiptap + 인라인/첨부 업로드 + CRUD)** (`docs/plans/M5-posts.md`).

---

문서 끝.
