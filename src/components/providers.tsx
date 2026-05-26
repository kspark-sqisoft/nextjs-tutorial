"use client";
// 클라이언트 측 Provider 모음.
// 지금은 TanStack Query 만. next-themes·next-intl Provider 는 마일스톤 9 에서 추가.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";

export function Providers({ children }: PropsWithChildren) {
  // 컴포넌트 마운트 1회만 QueryClient 생성.
  // 매 렌더마다 새 QueryClient 를 만들면 캐시가 전부 날아간다.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 학습 단계에선 stale 시간을 짧게 둬 무효화 흐름을 자주 본다.
            staleTime: 30_000,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
