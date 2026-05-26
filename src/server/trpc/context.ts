// HTTP 요청 → tRPC context 생성.
// access 쿠키의 JWT 를 검증해 ctx.user 를 채운다.
// getCurrentUser 는 React cache 로 같은 요청에서 1회만 DB 조회.
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getCurrentUser } from "@/server/auth/current-user";

export async function createContext(_opts: FetchCreateContextFnOptions) {
  const u = await getCurrentUser();
  return {
    user: u ? { id: u.id, role: u.role } : null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
