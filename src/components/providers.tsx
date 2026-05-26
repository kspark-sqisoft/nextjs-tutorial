"use client";
// 클라이언트 측 Provider 모음.
// 학습 포인트: tRPC react-query 통합은 trpc.Provider + QueryClientProvider 두 겹.
// next-themes·next-intl Provider 는 마일스톤 9 에서 추가.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { trpc, trpcLinks } from "@/lib/trpc-client";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000 },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({ links: trpcLinks() }),
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
