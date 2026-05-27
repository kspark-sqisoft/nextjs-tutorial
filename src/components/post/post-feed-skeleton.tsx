// Suspense fallback — 그리드용 카드 6개 placeholder.
export function PostFeedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-lg border bg-muted/40"
        />
      ))}
    </div>
  );
}
