// 부팅 검증용 라우터. 라우터 구조 학습 목적.
// 마일스톤 진행 중 인프라가 살아있는지 확인하는 가장 가벼운 procedure.
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  ping: publicProcedure.query(() => "pong" as const),
});
