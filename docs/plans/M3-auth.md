# M3 — 인증 (JWT 회전 + 이메일 인증) sub-plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`. 모든 step 은 체크박스(`- [ ]`).

**Goal:** 회원가입 → 이메일 인증 메일(Mailpit 수신) → 로그인 → access(15분) + refresh(30일) httpOnly Secure Cookie 발급 → access 만료 시 `/api/auth/refresh` 자동 회전 → 로그아웃까지 풀 플로우. `useActionState` + `useFormStatus` 가 회원가입/로그인 폼에서 학습된다.

**Architecture:** 비밀번호는 argon2id. JWT 는 jose 로 서명·검증. refresh 토큰의 평문은 클라이언트 쿠키에만 두고 DB(`sessions`) 에는 SHA-256 해시만. 회전 시 기존 세션을 revoke + `replaced_by` 로 체인 추적. 같은 refresh 두 번째 사용은 재사용 공격으로 보고 user 의 모든 세션을 revoke.

**Tech Stack:** jose 5+, @node-rs/argon2 1.8+, nodemailer + Mailpit, react-email + @react-email/components.

---

## 사전 조건

- [x] M1, M2 완료. `users / sessions / email_verifications / password_resets` 테이블 적용됨.
- [x] `.env` 에 `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` 32자 이상 (`openssl rand -base64 48`).
- [x] Mailpit 컨테이너 동작 (`http://localhost:8025` 접속 가능).

---

## 파일 구조

**Create (`src/server/auth/`):**
- `password.ts` — argon2id hash/verify
- `jwt.ts` — jose access/refresh sign/verify
- `cookies.ts` — auth 쿠키 set/clear/get
- `session.ts` — 세션 create/rotate/revoke/detectReuse
- `tokens.ts` — 이메일·비번 재설정 토큰 발급/소비
- `current-user.ts` — RSC/Action 에서 현재 user 조회

**Create (`src/server/mail/`):**
- `transport.ts` — nodemailer + Mailpit
- `templates/verify-email.tsx` — React Email
- `templates/reset-password.tsx` — React Email
- `send.ts` — render → transport.sendMail wrapper

**Create (`src/server/actions/`):**
- `auth.ts` — signUp/signIn/signOut/verifyEmail/requestPasswordReset/resetPassword Server Actions

**Create (`src/app/`):**
- `api/auth/refresh/route.ts` — refresh 회전 Route Handler
- `[locale]/(auth)/sign-up/page.tsx`, `sign-in/page.tsx`, `verify-email/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`

**Create (`src/components/auth/`):**
- `sign-up-form.tsx`, `sign-in-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`

**Create:**
- `src/middleware.ts` — 보호 경로 가드 (access 쿠키 존재 검사)

**Modify:**
- `src/server/trpc/context.ts` — access 검증해 `ctx.user` 채움
- `src/server/trpc/trpc.ts` — `protectedProcedure`, `adminProcedure` 추가

**Test:**
- `tests/auth/password.test.ts`, `tests/auth/jwt.test.ts`, `tests/auth/session.test.ts`

**Add deps:** `jose@^5`, `@node-rs/argon2@^1.8`, `nodemailer@^6`, `@types/nodemailer@^6`, `@react-email/components@^0.0.31`, `react-email@^3` (개발 미리보기 옵션).

---

## 작업 단위 (Task) 분해

총 8 Task. 각 Task 끝에 커밋.

- Task 1: deps 설치 + password.ts (argon2)
- Task 2: jwt.ts (jose)
- Task 3: cookies.ts + tokens.ts
- Task 4: session.ts (회전/재사용 감지)
- Task 5: mail (transport + 2 templates + send)
- Task 6: Server Actions (signUp/signIn/signOut/verifyEmail/resetPassword)
- Task 7: /api/auth/refresh + middleware + tRPC context/procedure
- Task 8: Auth 페이지 + 폼 컴포넌트 (`useActionState` + `useFormStatus`)

---

## Task 1 — argon2 비밀번호 해싱

**Files:** `src/server/auth/password.ts`, `tests/auth/password.test.ts`

### Steps

- [x] **1.1 deps 설치**

```bash
docker compose -f compose.dev.yml exec app pnpm add @node-rs/argon2 jose nodemailer @react-email/components
docker compose -f compose.dev.yml exec app pnpm add -D @types/nodemailer react-email
```

호스트에서도:
```bash
pnpm install
```

- [x] **1.2 password.ts**

```ts
// argon2id — OWASP 권장 비밀번호 해시. bcrypt 보다 메모리/시간 비용 조절이 명확.
// 학습 포인트: salt 는 라이브러리가 자동 생성·인코딩한다. 해시 문자열 안에 salt+params 가 다 들어 있어 단일 컬럼 저장.
import { hash, verify, Algorithm } from "@node-rs/argon2";

const COMMON_OPTS = {
  algorithm: Algorithm.Argon2id,
  // 학습용 합리적 default. 운영은 부하 측정 후 상향.
  memoryCost: 19_456,   // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, COMMON_OPTS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    // 해시 문자열이 손상된 경우에도 false 로 안전 실패.
    return false;
  }
}
```

- [x] **1.3 테스트 `tests/auth/password.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("argon2 password", () => {
  it("hash → verify 가 일치", async () => {
    const h = await hashPassword("hunter2");
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(h, "hunter2")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
  });

  it("같은 비밀번호도 매 hash 가 다르다 (random salt)", async () => {
    const a = await hashPassword("samepw");
    const b = await hashPassword("samepw");
    expect(a).not.toBe(b);
  });
});
```

- [x] **1.4 실행/커밋**

```bash
pnpm test tests/auth/password.test.ts
git add src/server/auth/password.ts tests/auth/password.test.ts package.json pnpm-lock.yaml
git commit -m "feat(auth): argon2id password hashing"
```

---

## Task 2 — jose JWT (access / refresh)

**Files:** `src/server/auth/jwt.ts`, `tests/auth/jwt.test.ts`

### Steps

- [x] **2.1 jwt.ts**

```ts
// jose — Edge runtime 호환 (Web Crypto). httpOnly 쿠키와 짝지어 SSR/RSC 양쪽에서 사용.
// access: 짧게(15분), payload 에 role 포함 — 권한 체크가 흔히 일어남.
// refresh: 길게(30일), payload 에 jti(=sessionId) 만. 실제 권한은 access 가 책임.
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export type Role = "USER" | "ADMIN";
export interface AccessPayload extends JWTPayload {
  sub: string;
  role: Role;
}
export interface RefreshPayload extends JWTPayload {
  sub: string;
  jti: string;
}

export async function signAccess(p: { sub: string; role: Role }) {
  return new SignJWT({ role: p.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL}s`)
    .sign(accessKey);
}

export async function verifyAccess(token: string): Promise<AccessPayload> {
  const { payload } = await jwtVerify<AccessPayload>(token, accessKey);
  return payload;
}

export async function signRefresh(p: { sub: string; jti: string }) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setJti(p.jti)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_REFRESH_TTL}s`)
    .sign(refreshKey);
}

export async function verifyRefresh(token: string): Promise<RefreshPayload> {
  const { payload } = await jwtVerify<RefreshPayload>(token, refreshKey);
  if (!payload.jti) throw new Error("refresh token missing jti");
  return payload;
}
```

- [x] **2.2 테스트**

```ts
// tests/auth/jwt.test.ts
import { describe, expect, it } from "vitest";
import { signAccess, verifyAccess, signRefresh, verifyRefresh } from "@/server/auth/jwt";

describe("jwt", () => {
  it("access 발급/검증 라운드트립", async () => {
    const t = await signAccess({ sub: "user-1", role: "USER" });
    const p = await verifyAccess(t);
    expect(p.sub).toBe("user-1");
    expect(p.role).toBe("USER");
  });

  it("refresh 는 jti 가 필수", async () => {
    const t = await signRefresh({ sub: "u", jti: "sess-1" });
    const p = await verifyRefresh(t);
    expect(p.jti).toBe("sess-1");
  });

  it("위조 토큰은 throw", async () => {
    await expect(verifyAccess("not.a.jwt")).rejects.toThrow();
  });
});
```

- [x] **2.3 커밋**

```bash
pnpm test tests/auth/jwt.test.ts
git add src/server/auth/jwt.ts tests/auth/jwt.test.ts
git commit -m "feat(auth): jose access/refresh JWT primitives"
```

---

## Task 3 — 쿠키 set/clear/get + 일회용 토큰

**Files:** `src/server/auth/cookies.ts`, `src/server/auth/tokens.ts`

### Steps

- [x] **3.1 cookies.ts**

```ts
// auth 쿠키 도우미. Server Action / Route Handler / RSC 어디서나 같은 키 사용.
// httpOnly: JS 접근 차단(XSS 완화)
// secure: HTTPS 에서만 (dev 에선 자동 false)
// sameSite: 'lax' — CSRF 완화 + 일반 페이지 이동은 허용.
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const ACCESS_COOKIE = "blog_at";
export const REFRESH_COOKIE = "blog_rt";

const isProd = process.env.NODE_ENV === "production";

export async function setAuthCookies(p: { access: string; refresh: string }) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, p.access, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: env.JWT_ACCESS_TTL,
  });
  jar.set(REFRESH_COOKIE, p.refresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    // 회전 라우트만 보내도 충분하지만, 학습 단순화 위해 site-wide.
    path: "/",
    maxAge: env.JWT_REFRESH_TTL,
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function readAccessCookie() {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshCookie() {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}
```

- [x] **3.2 tokens.ts**

```ts
// 일회용 토큰 (이메일 인증, 비밀번호 재설정) 공용 로직.
// 평문은 메일/링크에만 노출하고, DB 에는 SHA-256 해시만 저장한다.
import { createHash, randomBytes } from "node:crypto";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { emailVerifications, passwordResets } from "@/server/db/schema";

function sha256(plain: string) {
  return createHash("sha256").update(plain).digest("hex");
}

function newToken() {
  // URL-safe 32 바이트 = 256bit, base64url.
  return randomBytes(32).toString("base64url");
}

export async function issueEmailVerification(userId: string) {
  const plain = newToken();
  const tokenHash = sha256(plain);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24h
  await db.insert(emailVerifications).values({ userId, tokenHash, expiresAt });
  return plain; // 메일 본문에만 들어간다.
}

export async function consumeEmailVerification(plain: string) {
  const tokenHash = sha256(plain);
  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.tokenHash, tokenHash),
        isNull(emailVerifications.usedAt),
        gt(emailVerifications.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(eq(emailVerifications.id, row.id));
  return { userId: row.userId };
}

export async function issuePasswordReset(userId: string) {
  const plain = newToken();
  const tokenHash = sha256(plain);
  const expiresAt = new Date(Date.now() + 1 * 3600 * 1000); // 1h
  await db.insert(passwordResets).values({ userId, tokenHash, expiresAt });
  return plain;
}

export async function consumePasswordReset(plain: string) {
  const tokenHash = sha256(plain);
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, row.id));
  return { userId: row.userId };
}
```

- [x] **3.3 커밋**

```bash
git add src/server/auth/cookies.ts src/server/auth/tokens.ts
git commit -m "feat(auth): cookie helpers + single-use token issue/consume"
```

---

## Task 4 — 세션 회전 (rotate / detectReuse)

**Files:** `src/server/auth/session.ts`, `tests/auth/session.test.ts`

### Steps

- [x] **4.1 session.ts**

```ts
// 세션 = refresh 토큰의 서버측 상태.
// 회전 정책:
//  1) 발급 시 sessions row 생성, refresh JWT 의 jti = sessions.id.
//  2) /api/auth/refresh 호출 → 검증 후 새 sessionId 발급, 기존 세션 revoke + replaced_by 설정.
//  3) 이미 revoked 인 세션을 다시 회전 시도 → 재사용 공격으로 보고 user 의 모든 세션 revoke.
import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { signAccess, signRefresh, verifyRefresh, type Role } from "./jwt";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export interface IssuedTokens {
  access: string;
  refresh: string;
  sessionId: string;
}

export async function createSession(p: {
  userId: string;
  role: Role;
  ua?: string;
  ip?: string;
  ttlSeconds?: number;
}): Promise<IssuedTokens> {
  const sessionId = randomUUID();
  const refresh = await signRefresh({ sub: p.userId, jti: sessionId });
  await db.insert(sessions).values({
    id: sessionId,
    userId: p.userId,
    refreshTokenHash: sha256(refresh),
    userAgent: p.ua ?? null,
    ip: p.ip ?? null,
    expiresAt: new Date(
      Date.now() + (p.ttlSeconds ?? 30 * 24 * 3600) * 1000,
    ),
  });
  const access = await signAccess({ sub: p.userId, role: p.role });
  return { access, refresh, sessionId };
}

/** 회전 — 성공 시 새 토큰, 재사용 감지 시 throw('REUSE_DETECTED'). */
export async function rotateSession(refreshPlain: string): Promise<IssuedTokens> {
  const payload = await verifyRefresh(refreshPlain);
  const presentedHash = sha256(refreshPlain);
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, payload.jti))
    .limit(1);
  if (!row) throw new Error("UNKNOWN_SESSION");

  // 이미 revoke 된 세션을 다시 쓰려 함 → 재사용 공격.
  if (row.revokedAt) {
    await revokeAllForUser(row.userId);
    throw new Error("REUSE_DETECTED");
  }
  if (row.refreshTokenHash !== presentedHash) throw new Error("BAD_REFRESH");
  if (row.expiresAt.getTime() < Date.now()) throw new Error("EXPIRED");

  // role 은 최신 DB 값을 기준으로 (관리자 권한이 바뀌었을 수 있음).
  const [u] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  if (!u || !u.isActive) throw new Error("USER_DISABLED");

  // 새 세션 발급.
  const next = await createSession({ userId: row.userId, role: u.role });
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), replacedBy: next.sessionId })
    .where(eq(sessions.id, row.id));
  return next;
}

export async function revokeSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeAllForUser(userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
```

- [x] **4.2 테스트 `tests/auth/session.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import {
  createSession,
  rotateSession,
  revokeAllForUser,
} from "@/server/auth/session";

async function truncate() {
  await db.execute(
    sql`TRUNCATE TABLE email_verifications, password_resets, sessions, users RESTART IDENTITY CASCADE`,
  );
}

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: "s@example.com", passwordHash: "x", nickname: "s" })
    .returning({ id: users.id, role: users.role });
  return u!;
}

describe("session rotation", () => {
  beforeEach(truncate);
  afterAll(truncate);

  it("rotate 시 기존 세션 revoke + replaced_by 설정", async () => {
    const u = await seedUser();
    const a = await createSession({ userId: u.id, role: u.role });
    const b = await rotateSession(a.refresh);
    const [oldRow] = await db
      .select()
      .from(sessions)
      .where(sql`id = ${a.sessionId}`);
    expect(oldRow!.revokedAt).not.toBeNull();
    expect(oldRow!.replacedBy).toBe(b.sessionId);
  });

  it("같은 refresh 두 번 회전 시 user 전체 revoke", async () => {
    const u = await seedUser();
    const a = await createSession({ userId: u.id, role: u.role });
    const b = await rotateSession(a.refresh);
    // a.refresh 는 이미 revoked.
    await expect(rotateSession(a.refresh)).rejects.toThrow("REUSE_DETECTED");
    // b 도 같이 revoke 되어야 함.
    const [bRow] = await db
      .select()
      .from(sessions)
      .where(sql`id = ${b.sessionId}`);
    expect(bRow!.revokedAt).not.toBeNull();
  });

  it("revokeAllForUser", async () => {
    const u = await seedUser();
    await createSession({ userId: u.id, role: u.role });
    await createSession({ userId: u.id, role: u.role });
    await revokeAllForUser(u.id);
    const rows = await db.select().from(sessions);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });
});
```

- [x] **4.3 커밋**

```bash
pnpm test tests/auth/session.test.ts
git add src/server/auth/session.ts tests/auth/session.test.ts
git commit -m "feat(auth): session rotation with reuse detection"
```

---

## Task 5 — Mail (transport + React Email 템플릿)

**Files:** `src/server/mail/transport.ts`, `src/server/mail/send.ts`, `src/server/mail/templates/verify-email.tsx`, `src/server/mail/templates/reset-password.tsx`

### Steps

- [x] **5.1 transport.ts**

```ts
// Mailpit 은 인증 없는 SMTP 1025. 운영에서는 SES/SendGrid 등으로 교체.
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});
```

- [x] **5.2 templates/verify-email.tsx**

```tsx
import {
  Html, Head, Preview, Body, Container, Heading, Text, Button,
} from "@react-email/components";

export interface VerifyEmailProps {
  nickname: string;
  verifyUrl: string;
}

export default function VerifyEmail({ nickname, verifyUrl }: VerifyEmailProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>BLOG 이메일 인증</Preview>
      <Body style={{ fontFamily: "system-ui, -apple-system, sans-serif", padding: 24 }}>
        <Container>
          <Heading>안녕하세요, {nickname}님 👋</Heading>
          <Text>아래 버튼을 눌러 이메일 인증을 완료해주세요. 링크는 24시간 동안 유효합니다.</Text>
          <Button
            href={verifyUrl}
            style={{ background: "#111", color: "#fff", padding: "12px 18px", borderRadius: 6 }}
          >
            이메일 인증하기
          </Button>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 24 }}>
            직접 가입하지 않으셨다면 이 메일은 무시하셔도 됩니다.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [x] **5.3 templates/reset-password.tsx**

```tsx
import {
  Html, Head, Preview, Body, Container, Heading, Text, Button,
} from "@react-email/components";

export interface ResetPasswordProps {
  nickname: string;
  resetUrl: string;
}

export default function ResetPassword({ nickname, resetUrl }: ResetPasswordProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>비밀번호 재설정</Preview>
      <Body style={{ fontFamily: "system-ui, -apple-system, sans-serif", padding: 24 }}>
        <Container>
          <Heading>비밀번호 재설정</Heading>
          <Text>{nickname}님, 아래 버튼을 눌러 새 비밀번호를 설정하세요. 링크는 1시간 동안 유효합니다.</Text>
          <Button
            href={resetUrl}
            style={{ background: "#111", color: "#fff", padding: "12px 18px", borderRadius: 6 }}
          >
            비밀번호 재설정
          </Button>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 24 }}>
            요청하지 않았다면 이 메일을 무시하셔도 됩니다.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [x] **5.4 send.ts**

```ts
// React Email 컴포넌트를 HTML 문자열로 렌더하고 nodemailer 로 발송.
import { render } from "@react-email/components";
import VerifyEmail from "./templates/verify-email";
import ResetPassword from "./templates/reset-password";
import { transporter } from "./transport";
import { env } from "@/lib/env";

export async function sendVerifyEmail(p: {
  to: string;
  nickname: string;
  token: string;
}) {
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/ko/verify-email?token=${encodeURIComponent(p.token)}`;
  const html = await render(VerifyEmail({ nickname: p.nickname, verifyUrl }));
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: p.to,
    subject: "[BLOG] 이메일 인증",
    html,
  });
}

export async function sendResetPasswordEmail(p: {
  to: string;
  nickname: string;
  token: string;
}) {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/ko/reset-password?token=${encodeURIComponent(p.token)}`;
  const html = await render(ResetPassword({ nickname: p.nickname, resetUrl }));
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: p.to,
    subject: "[BLOG] 비밀번호 재설정",
    html,
  });
}
```

- [x] **5.5 커밋**

```bash
git add src/server/mail/
git commit -m "feat(mail): mailpit transport + verify/reset email templates"
```

---

## Task 6 — Server Actions (signUp / signIn / signOut / verifyEmail / resetPassword)

**Files:** `src/server/actions/auth.ts`

### Steps

- [x] **6.1 입력 스키마 + Action 본문**

```ts
"use server";
// 학습 포인트:
//  - 폼 제출은 Server Actions 로 (`useActionState` 와 결합).
//  - mutation 후 영향 받는 경로는 revalidatePath.
//  - 에러는 throw 가 아니라 { ok:false, message } 로 반환해 UI 가 그대로 표시하게 한다.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, revokeSession } from "@/server/auth/session";
import {
  setAuthCookies, clearAuthCookies, readRefreshCookie,
} from "@/server/auth/cookies";
import {
  issueEmailVerification, consumeEmailVerification,
  issuePasswordReset, consumePasswordReset,
} from "@/server/auth/tokens";
import { sendVerifyEmail, sendResetPasswordEmail } from "@/server/mail/send";
import { verifyRefresh } from "@/server/auth/jwt";

export type ActionState =
  | { ok: false; message: string }
  | { ok: true; message?: string }
  | null;

const SignUpInput = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(8, "비밀번호는 8자 이상").max(72),
  nickname: z.string().min(2).max(20),
});

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SignUpInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]!.message };
  }
  const { email, password, nickname } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return { ok: false, message: "이미 가입된 이메일입니다." };

  const passwordHash = await hashPassword(password);
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash, nickname })
    .returning({ id: users.id, nickname: users.nickname });

  const token = await issueEmailVerification(u!.id);
  await sendVerifyEmail({ to: email, nickname: u!.nickname, token });

  return { ok: true, message: "메일함을 확인해 이메일 인증을 완료해주세요." };
}

const SignInInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SignInInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "이메일/비밀번호를 확인해주세요." };
  const { email, password } = parsed.data;

  const [u] = await db
    .select({
      id: users.id, role: users.role, passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt, isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u) return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  if (!u.isActive) return { ok: false, message: "비활성화된 계정입니다." };
  const ok = await verifyPassword(u.passwordHash, password);
  if (!ok) return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  if (!u.emailVerifiedAt) return { ok: false, message: "이메일 인증이 필요합니다." };

  const { access, refresh } = await createSession({ userId: u.id, role: u.role });
  await setAuthCookies({ access, refresh });
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const refresh = await readRefreshCookie();
  if (refresh) {
    try {
      const p = await verifyRefresh(refresh);
      await revokeSession(p.jti);
    } catch {
      // 위조/만료된 refresh 라면 그냥 쿠키만 지운다.
    }
  }
  await clearAuthCookies();
  redirect("/sign-in");
}

const VerifyEmailInput = z.object({ token: z.string().min(10) });

export async function verifyEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = VerifyEmailInput.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { ok: false, message: "잘못된 인증 링크입니다." };
  const result = await consumeEmailVerification(parsed.data.token);
  if (!result) return { ok: false, message: "만료되었거나 이미 사용된 링크입니다." };
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, result.userId));
  revalidatePath("/");
  return { ok: true, message: "이메일 인증이 완료되었습니다. 이제 로그인 할 수 있어요." };
}

const RequestResetInput = z.object({ email: z.string().email() });

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RequestResetInput.safeParse({ email: formData.get("email") });
  // 이메일 존재 여부를 응답으로 노출하지 않는다(계정 열거 방지).
  if (!parsed.success) return { ok: true, message: "메일을 보냈습니다(존재한다면)." };
  const [u] = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (u) {
    const token = await issuePasswordReset(u.id);
    await sendResetPasswordEmail({ to: parsed.data.email, nickname: u.nickname, token });
  }
  return { ok: true, message: "메일을 보냈습니다(존재한다면)." };
}

const ResetPasswordInput = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(72),
});

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ResetPasswordInput.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "입력을 확인해주세요." };
  const consumed = await consumePasswordReset(parsed.data.token);
  if (!consumed) return { ok: false, message: "만료되었거나 이미 사용된 링크입니다." };
  const passwordHash = await hashPassword(parsed.data.password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, consumed.userId));
  return { ok: true, message: "비밀번호가 변경되었습니다. 다시 로그인 해주세요." };
}
```

- [x] **6.2 커밋**

```bash
git add src/server/actions/auth.ts
git commit -m "feat(auth): server actions for sign-up/in/out + email verify + password reset"
```

---

## Task 7 — `/api/auth/refresh` + middleware + tRPC context/procedure

**Files:** `src/app/api/auth/refresh/route.ts`, `src/middleware.ts`, `src/server/trpc/context.ts`(modify), `src/server/trpc/trpc.ts`(modify), `src/server/auth/current-user.ts`

### Steps

- [x] **7.1 refresh Route Handler**

```ts
// /api/auth/refresh — POST.
// 클라이언트(tRPC link)가 401 응답 시 호출 → 회전 → 새 쿠키.
import { NextResponse } from "next/server";
import { rotateSession } from "@/server/auth/session";
import { readRefreshCookie, setAuthCookies, clearAuthCookies } from "@/server/auth/cookies";

export async function POST() {
  const refresh = await readRefreshCookie();
  if (!refresh) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const next = await rotateSession(refresh);
    await setAuthCookies({ access: next.access, refresh: next.refresh });
    return NextResponse.json({ ok: true });
  } catch {
    await clearAuthCookies();
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
```

- [x] **7.2 middleware**

```ts
// Next.js middleware — 보호 경로에 access 쿠키가 있는지만 검사.
// 서명 검증은 RSC/tRPC 레이어가 한다(미들웨어는 Edge runtime, 가볍게).
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/server/auth/cookies";

const PROTECTED = [/^\/(ko|en)\/me(\/|$)/, /^\/(ko|en)\/posts\/new$/, /^\/(ko|en)\/posts\/.+\/edit$/, /^\/(ko|en)\/admin/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();
  if (req.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/ko/sign-in";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // i18n + 정적 자원 제외.
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
```

- [x] **7.3 current-user.ts**

```ts
// RSC / Server Action 에서 사용할 현재 user 조회 도우미.
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { readAccessCookie } from "./cookies";
import { verifyAccess } from "./jwt";

export const getCurrentUser = cache(async () => {
  const token = await readAccessCookie();
  if (!token) return null;
  try {
    const p = await verifyAccess(token);
    const [u] = await db
      .select({
        id: users.id, email: users.email, nickname: users.nickname,
        role: users.role, avatarKey: users.avatarKey, isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, p.sub))
      .limit(1);
    if (!u || !u.isActive) return null;
    return u;
  } catch {
    return null;
  }
});
```

- [x] **7.4 context.ts 수정**

```ts
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getCurrentUser } from "@/server/auth/current-user";

export async function createContext(_opts: FetchCreateContextFnOptions) {
  const u = await getCurrentUser();
  return {
    user: u ? { id: u.id, role: u.role } : null,
  };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
```

- [x] **7.5 trpc.ts 수정 — protectedProcedure / adminProcedure**

```ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});
```

- [x] **7.6 커밋**

```bash
git add src/app/api/auth/refresh/route.ts src/middleware.ts \
  src/server/auth/current-user.ts src/server/trpc/context.ts src/server/trpc/trpc.ts
git commit -m "feat(auth): refresh route + middleware guard + protected/admin procedures"
```

---

## Task 8 — 인증 페이지 + 폼 컴포넌트 (`useActionState` + `useFormStatus`)

**Files:** `src/app/[locale]/(auth)/...`, `src/components/auth/*`

> 이 시점에 i18n 도입이 정식으로 안 됐다면, 임시로 `src/app/(auth)/...` 로 두고 M9 에서 `[locale]` 로 옮긴다. 이 sub-plan 은 `[locale]` 전제로 작성.

### Steps

- [x] **8.1 SignUpForm `src/components/auth/sign-up-form.tsx`**

```tsx
"use client";
// React 19 의 useActionState + useFormStatus 패턴 데모.
// - useActionState: 액션 결과를 state 로 받아 UI 에 표시.
// - useFormStatus: form 안의 child component 에서 pending 여부 구독.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction, type ActionState } from "@/server/actions/auth";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "처리 중..." : label}
    </button>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState<ActionState, FormData>(signUpAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="email" type="email" required placeholder="이메일"
        className="rounded border px-3 py-2" />
      <input name="nickname" required minLength={2} maxLength={20} placeholder="닉네임"
        className="rounded border px-3 py-2" />
      <input name="password" type="password" required minLength={8} placeholder="비밀번호 (8자 이상)"
        className="rounded border px-3 py-2" />
      <SubmitButton label="회원가입" />
      {state && (
        <p className={state.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
```

- [x] **8.2 SignInForm `src/components/auth/sign-in-form.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type ActionState } from "@/server/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
      {pending ? "로그인 중..." : "로그인"}
    </button>
  );
}

export function SignInForm() {
  const [state, action] = useActionState<ActionState, FormData>(signInAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="email" type="email" required placeholder="이메일" className="rounded border px-3 py-2" />
      <input name="password" type="password" required placeholder="비밀번호" className="rounded border px-3 py-2" />
      <SubmitButton />
      {state && !state.ok && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
```

- [x] **8.3 ForgotPasswordForm / ResetPasswordForm**

비슷한 패턴으로 `requestPasswordResetAction`, `resetPasswordAction` 을 `useActionState` 로 묶는다. (생략 — 위 SignInForm 형태를 그대로 따라간다.)

- [x] **8.4 페이지들**

```tsx
// src/app/[locale]/(auth)/sign-up/page.tsx
import { SignUpForm } from "@/components/auth/sign-up-form";
export default function Page() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">회원가입</h1>
      <SignUpForm />
    </main>
  );
}
```

```tsx
// src/app/[locale]/(auth)/sign-in/page.tsx
import { SignInForm } from "@/components/auth/sign-in-form";
export default function Page() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">로그인</h1>
      <SignInForm />
    </main>
  );
}
```

```tsx
// src/app/[locale]/(auth)/verify-email/page.tsx
import { verifyEmailAction } from "@/server/actions/auth";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="p-8">잘못된 링크입니다.</p>;
  const fd = new FormData(); fd.set("token", token);
  const result = await verifyEmailAction(null, fd);
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-xl font-semibold">이메일 인증</h1>
      <p className={result && result.ok ? "text-green-600" : "text-red-600"}>
        {result?.message ?? ""}
      </p>
    </main>
  );
}
```

forgot-password / reset-password 페이지는 ForgotPasswordForm / ResetPasswordForm 을 마운트.

- [x] **8.5 로그아웃 버튼 (어디든 헤더)**

```tsx
import { signOutAction } from "@/server/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="text-sm text-zinc-500 underline">로그아웃</button>
    </form>
  );
}
```

- [x] **8.6 수동 검증 시나리오**

1. `/ko/sign-up` 회원가입 → Mailpit `http://localhost:8025` 에서 메일 수신 확인.
2. 메일의 인증 링크 클릭 → 인증 완료 메시지.
3. `/ko/sign-in` 로그인 → DevTools Application → Cookies 에 `blog_at`, `blog_rt` 확인.
4. `.env` 의 `JWT_ACCESS_TTL=30` 으로 임시 단축 후 30초 대기 → 보호된 페이지 접근 시 자동 refresh 동작 확인.
5. 같은 refresh 두 번 사용 → 두 번째에 user 전체 세션 revoke.

- [x] **8.7 커밋**

```bash
git add src/components/auth/ src/app/\[locale\]/\(auth\)/
git commit -m "feat(auth): sign-up/in/out + email verify + password reset pages"
```

---

## 마일스톤 종료 체크리스트

- [x] `pnpm test` 의 password / jwt / session 통과.
- [x] 회원가입 → Mailpit 메일 → 인증 → 로그인 → 보호 페이지 접근 정상.
- [x] access 만료 후 자동 refresh 회전 동작.
- [x] 같은 refresh 두 번째 사용 시 user 전체 세션 revoke (DB 확인).
- [x] 모든 새 파일에 한국어 주석.

---

## 다음 단계

**M4 — 프로필 + Presigned 업로드** (`docs/plans/M4-profile-upload.md`) 로 진행.

---

문서 끝.
