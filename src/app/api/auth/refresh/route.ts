// /api/auth/refresh — POST.
// 클라이언트(tRPC link)가 401 응답 시 호출 → 회전 → 새 쿠키.
import { NextResponse } from "next/server";
import { rotateSession } from "@/server/auth/session";
import {
  readRefreshCookie,
  setAuthCookies,
  clearAuthCookies,
} from "@/server/auth/cookies";

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
