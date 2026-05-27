// 홈 — 최근 글 피드 (RSC prefetch + HydrationBoundary).
// 학습 포인트:
//  - 첫 페이지는 RSC 가 prefetch 해 첫 paint 에 노출, 이후 페이지는 클라이언트의 useInfiniteQuery 가 이어감.
//  - Hero 는 정적 — RSC 가 직접 출력. 검색폼만 Client.
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
    <main className="mx-auto max-w-6xl px-6">
      {/* Hero — Apple 톤: 큰 타이포, tight tracking, 살짝 그라데이션 글자. */}
      <section className="py-10 md:py-14">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Learn · Build · Ship
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
          <span className="block">Next.js 15 를</span>
          <span className="block bg-gradient-to-br from-foreground via-foreground/80 to-foreground/40 bg-clip-text text-transparent">
            손에 익히는 가장 빠른 길.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          React 19 의 신훅, Server Actions, Suspense streaming, 그리고 View
          Transitions 까지 — 진짜 동작하는 블로그를 만들며 한 줄씩
          기록합니다.
        </p>
        <div className="mt-6 max-w-md">
          <SearchForm initial="" />
        </div>
      </section>

      {/* Feed 섹션 — 헤더가 작아도 카드들이 시각적 무게를 가짐. */}
      <section className="pb-24">
        <div className="mb-8 flex items-end justify-between border-b border-border/60 pb-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("recent")}
          </h2>
          <span className="text-xs text-muted-foreground">
            가장 최근의 12개 글
          </span>
        </div>
        <HydrationBoundary state={state}>
          <Suspense fallback={<PostFeedSkeleton />}>
            <PostFeed source={{ kind: "list" }} initialLimit={12} />
          </Suspense>
        </HydrationBoundary>
      </section>
    </main>
  );
}
