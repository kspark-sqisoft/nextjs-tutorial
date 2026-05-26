// tRPC 초기화 — context 와 transformer(superjson) 만 지정.
// 학습 포인트: superjson 은 Date/Map/Set 등을 손실 없이 직렬화해
// 서버에서 반환한 Date 객체가 클라이언트에서 그대로 Date 로 도착하게 한다.
// 보호된 procedure(protectedProcedure) 는 마일스톤 3 에서 추가한다.
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
