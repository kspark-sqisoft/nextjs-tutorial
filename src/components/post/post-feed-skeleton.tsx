// Suspense fallback — 첫 페이지 fetch 가 늦으면 깜빡임 대신 로딩 카드 노출.
export function PostFeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
