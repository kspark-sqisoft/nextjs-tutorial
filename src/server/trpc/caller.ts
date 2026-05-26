// RSC 에서 tRPC procedure 를 HTTP 없이 직접 호출하기 위한 caller.
// 학습 포인트: appRouter.createCaller(ctx) 는 React Query 캐시를 거치지 않고
// 직접 procedure 를 실행한다. RSC fetch 가 그대로 SSR 응답에 들어간다.
import { headers as nextHeaders } from "next/headers";
import { appRouter } from "./routers/_app";
import { createContext } from "./context";

export async function createCaller() {
  const h = await nextHeaders();
  return appRouter.createCaller(
    await createContext({
      req: new Request("http://internal/", { headers: h }),
      resHeaders: new Headers(),
    } as unknown as Parameters<typeof createContext>[0]),
  );
}
