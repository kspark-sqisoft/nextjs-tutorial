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
