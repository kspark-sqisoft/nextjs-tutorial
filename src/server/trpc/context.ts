// HTTP 요청 → tRPC context 생성.
// 지금은 user 가 항상 null 이지만, 마일스톤 3 에서 쿠키의 access JWT 를
// 검증해 { id, role } 형태로 채우게 된다.
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export function createContext(_opts: FetchCreateContextFnOptions) {
  return {
    user: null as null | { id: string; role: "USER" | "ADMIN" },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
