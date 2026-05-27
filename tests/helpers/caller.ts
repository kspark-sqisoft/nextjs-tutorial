// 테스트 전용 tRPC caller 헬퍼.
// 학습 포인트:
//  - appRouter.createCaller(ctx) 는 HTTP / fetch 없이 procedure 를 직접 호출 가능.
//  - context 는 production 의 createContext 와 동일 모양 ({ user } | null) 으로 만들어 준다.
//  - 이렇게 만들면 protectedProcedure / adminProcedure 미들웨어가 실제 코드 그대로 검증된다.
import { appRouter } from "@/server/trpc/routers/_app";

export function callerForUser(
  userId: string,
  role: "USER" | "ADMIN" = "USER",
) {
  return appRouter.createCaller({ user: { id: userId, role } });
}

export function publicCaller() {
  return appRouter.createCaller({ user: null });
}
