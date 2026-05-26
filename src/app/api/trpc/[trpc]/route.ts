// App Router 에 fetch 어댑터로 tRPC 를 마운트.
// 학습 포인트: 단일 catch-all route 가 GET/POST 둘 다 처리한다.
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createContext(opts),
    onError({ error, path }) {
      // 학습용 로깅. 운영에선 구조화 로깅으로 교체.
      console.error(`[tRPC] ${path ?? "<no-path>"}:`, error.message);
    },
  });

export { handler as GET, handler as POST };
