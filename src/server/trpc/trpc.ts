// tRPC 초기화 — context 와 transformer(superjson) 지정.
// 학습 포인트: superjson 은 Date/Map/Set 등을 손실 없이 직렬화한다.
//
// 미들웨어 3종:
//   - publicProcedure  : 누구나
//   - protectedProcedure: ctx.user 가 있어야 함 (없으면 UNAUTHORIZED)
//   - adminProcedure   : ctx.user.role === 'ADMIN' (없으면 FORBIDDEN)
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

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
