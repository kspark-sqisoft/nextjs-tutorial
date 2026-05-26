// 모든 도메인 라우터를 합치는 루트 라우터.
// 새 도메인을 추가할 때마다 import + 키 등록만 하면 된다.
import { router } from "../trpc";
import { healthRouter } from "./health";
import { profileRouter } from "./profile";
import { postRouter } from "./post";
import { commentRouter } from "./comment";
import { likeRouter } from "./like";
import { bookmarkRouter } from "./bookmark";

export const appRouter = router({
  health: healthRouter,
  profile: profileRouter,
  post: postRouter,
  comment: commentRouter,
  like: likeRouter,
  bookmark: bookmarkRouter,
});

// 클라이언트(`@trpc/react-query`) 가 사용할 타입.
export type AppRouter = typeof appRouter;
