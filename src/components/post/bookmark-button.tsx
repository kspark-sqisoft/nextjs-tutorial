"use client";
// 학습 포인트: useOptimistic 의 토글 패턴 (단일 boolean).
import { useOptimistic, useTransition } from "react";
import { trpc } from "@/lib/trpc-client";

export function BookmarkButton({
  postId,
  initialBookmarked,
}: {
  postId: string;
  initialBookmarked: boolean;
}) {
  const toggle = trpc.bookmark.toggle.useMutation();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    initialBookmarked,
    (_state, next: boolean) => next,
  );

  function onClick() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        const r = await toggle.mutateAsync({ postId });
        setOptimistic(r.bookmarked);
      } catch {
        // 다음 RSC refresh 가 진실로 덮어쓴다.
      }
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      {optimistic ? "★ 북마크됨" : "☆ 북마크"}
    </button>
  );
}
