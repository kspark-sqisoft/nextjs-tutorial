"use client";
// 학습 포인트:
//  - useInfiniteQuery 의 getNextPageParam 으로 cursor 페이지네이션.
//  - IntersectionObserver 로 sentinel 가시 시 fetchNextPage.
//  - source 분기로 list/tag/category 와 search 두 query 를 한 컴포넌트에 결합.
//    (conditional hook 회피를 위해 두 useInfiniteQuery 를 모두 호출하되 enabled 로 제어.)
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc-client";
import { PostCard } from "./post-card";

type FeedSource =
  | { kind: "list"; tagSlug?: string; categorySlug?: string }
  | { kind: "search"; q: string };

export function PostFeed({
  source,
  initialLimit = 10,
}: {
  source: FeedSource;
  initialLimit?: number;
}) {
  const sentinel = useRef<HTMLDivElement | null>(null);

  const listQ = trpc.post.list.useInfiniteQuery(
    {
      limit: initialLimit,
      tagSlug: source.kind === "list" ? (source.tagSlug ?? null) : null,
      categorySlug:
        source.kind === "list" ? (source.categorySlug ?? null) : null,
    },
    {
      enabled: source.kind === "list",
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    },
  );

  const searchQ = trpc.post.search.useInfiniteQuery(
    { q: source.kind === "search" ? source.q : "", limit: initialLimit },
    {
      enabled: source.kind === "search",
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    },
  );

  // 두 query 의 union 은 TS 좁힘이 잘 안 되므로 listQ 타입으로 통일해 cast.
  // 런타임 데이터 모양은 list/search 가 같다 ({ items, nextCursor }).
  const q = (
    source.kind === "search" ? searchQ : listQ
  ) as typeof listQ;

  useEffect(() => {
    if (!sentinel.current) return;
    const el = sentinel.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
            q.fetchNextPage();
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage, q]);

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
      {!items.length && !q.isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">결과가 없습니다.</p>
      )}
      <div ref={sentinel} className="h-6" />
      {q.isFetchingNextPage && (
        <p className="text-center text-xs text-muted-foreground">
          더 불러오는 중…
        </p>
      )}
      {!q.hasNextPage && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">— 끝 —</p>
      )}
    </div>
  );
}
