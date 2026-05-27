// /search?q=… — PG Full-text Search 결과 (RSC prefetch + HydrationBoundary).
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";
import { SearchForm } from "@/components/post/search-form";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  let state: ReturnType<typeof dehydrate> | undefined;
  if (query) {
    const helpers = await getTrpcHelpers();
    await helpers.post.search.prefetchInfinite({ q: query, limit: 12 });
    state = dehydrate(helpers.queryClient);
  }
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">검색</h1>
      <div className="max-w-md">
        <SearchForm initial={query} />
      </div>
      {!query ? (
        <p className="mt-6 text-sm text-muted-foreground">
          검색어를 입력해주세요.
        </p>
      ) : (
        <div className="mt-6">
          <HydrationBoundary state={state!}>
            <Suspense fallback={<PostFeedSkeleton />}>
              <PostFeed
                source={{ kind: "search", q: query }}
                initialLimit={12}
              />
            </Suspense>
          </HydrationBoundary>
        </div>
      )}
    </main>
  );
}
