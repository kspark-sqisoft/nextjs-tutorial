// RSC 에서 prefetch 후 dehydrate 까지 가능한 helpers.
// 학습 포인트: trpc/react-query 의 createServerSideHelpers 는
// 내부적으로 QueryClient 를 만들어 server-side fetch 결과를 query cache 에 채워준다.
// 페이지 RSC 가 await prefetch* 후 dehydrate(queryClient) 를 <HydrationBoundary state={...}>
// 에 전달하면, 클라이언트의 useInfiniteQuery 가 그 캐시를 그대로 hydrate 해 첫 페이지 fetch 없이 시작한다.
import "server-only";
import { createServerSideHelpers } from "@trpc/react-query/server";
import superjson from "superjson";
import { headers as nextHeaders } from "next/headers";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";

export async function getTrpcHelpers() {
  const h = await nextHeaders();
  return createServerSideHelpers({
    router: appRouter,
    ctx: await createContext({
      req: new Request("http://internal/", { headers: h }),
      resHeaders: new Headers(),
    } as unknown as Parameters<typeof createContext>[0]),
    transformer: superjson,
  });
}
