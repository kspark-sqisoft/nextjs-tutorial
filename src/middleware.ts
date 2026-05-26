// Next.js middleware — 보호 경로에 access 쿠키가 있는지만 검사.
// 서명 검증은 RSC/tRPC 레이어가 한다(미들웨어는 Edge runtime, 가볍게).
// next-intl 결합은 M9 에서 적용.
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/server/auth/cookies";

const PROTECTED = [
  /^\/me(\/|$)/,
  /^\/(ko|en)\/me(\/|$)/,
  /^\/posts\/new$/,
  /^\/(ko|en)\/posts\/new$/,
  /^\/posts\/.+\/edit$/,
  /^\/(ko|en)\/posts\/.+\/edit$/,
  /^\/admin/,
  /^\/(ko|en)\/admin/,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();
  if (req.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // i18n / 정적 자원 / API / favicon 제외.
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
