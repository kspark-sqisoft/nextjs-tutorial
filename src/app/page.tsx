// 홈 — 최근 글 피드 (RSC prefetch + HydrationBoundary).
// 첫 페이지는 RSC 가 prefetch 해 첫 paint 에 노출, 이후 페이지는 클라이언트의 useInfiniteQuery 가 이어감.
import Link from "next/link";
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getCurrentUser } from "@/server/auth/current-user";
import { getTrpcHelpers } from "@/lib/trpc-server";
import { PostFeed } from "@/components/post/post-feed";
import { PostFeedSkeleton } from "@/components/post/post-feed-skeleton";
import { SearchForm } from "@/components/post/search-form";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function HomePage() {
  const me = await getCurrentUser();
  const helpers = await getTrpcHelpers();
  await helpers.post.list.prefetchInfinite({
    limit: 10,
    tagSlug: null,
    categorySlug: null,
  });
  const state = dehydrate(helpers.queryClient);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">학습용 블로그</h1>
          <span className="text-xs text-zinc-500">최근 글</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {me ? (
            <>
              <span className="text-zinc-500">
                👋 <strong>{me.nickname}</strong>
              </span>
              <Link href="/me" className="underline">
                프로필
              </Link>
              <Link
                href="/posts/new"
                className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                글쓰기
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="underline">
                로그인
              </Link>
              <Link href="/sign-up" className="underline">
                회원가입
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="mb-6">
        <SearchForm initial="" />
      </div>

      <HydrationBoundary state={state}>
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeed source={{ kind: "list" }} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
