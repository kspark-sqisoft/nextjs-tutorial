// 홈 — 최근 글 피드 (RSC prefetch + HydrationBoundary).
// 첫 페이지는 RSC 가 prefetch 해 첫 paint 에 노출, 이후 페이지는 클라이언트의 useInfiniteQuery 가 이어감.
// 전역 헤더(네비, 테마/언어 토글, 로그인/로그아웃)는 layout 의 <Header /> 가 담당.
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";
import { SearchForm } from "@/components/post/search-form";

export default async function HomePage() {
  const t = await getTranslations("post");
  const helpers = await getTrpcHelpers();
  await helpers.post.list.prefetchInfinite({
    limit: 12,
    tagSlug: null,
    categorySlug: null,
  });
  const state = dehydrate(helpers.queryClient);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("recent")}
        </h1>
        <div className="w-full max-w-md">
          <SearchForm initial="" />
        </div>
      </div>

      <HydrationBoundary state={state}>
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeed source={{ kind: "list" }} initialLimit={12} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
