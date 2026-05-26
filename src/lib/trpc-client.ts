"use client";
// 클라이언트에서 사용할 tRPC react-query 통합.
// 학습 포인트: links 의 superjson transformer 는 서버와 반드시 일치해야 한다.
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/trpc/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

export function trpcLinks() {
  return [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // 쿠키 동봉 — same-origin 이라 별도 설정 없이 자동.
      fetch(input, init) {
        return fetch(input, { ...init, credentials: "include" });
      },
    }),
  ];
}
