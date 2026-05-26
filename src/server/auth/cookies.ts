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
