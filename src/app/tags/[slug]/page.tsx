// /tags/[slug] — 해당 태그 글만 (RSC prefetch + HydrationBoundary).
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const helpers = await getTrpcHelpers();
  await helpers.post.list.prefetchInfinite({
    limit: 10,
    tagSlug: slug,
    categorySlug: null,
  });
  const state = dehydrate(helpers.queryClient);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">#{slug}</h1>
      <HydrationBoundary state={state}>
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeed source={{ kind: "list", tagSlug: slug }} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
