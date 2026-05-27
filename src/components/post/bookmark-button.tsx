"use client";
// 학습 포인트: useOptimistic 의 토글 패턴 (단일 boolean).
// LikeButton 과 같은 이유로 mutation 후 router.refresh() 로 RSC base state 갱신.
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";

export function BookmarkButton({
  postId,
  initialBookmarked,
}: {
  postId: string;
  initialBookmarked: boolean;
}) {
  const router = useRouter();
  const toggle = trpc.bookmark.toggle.useMutation();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    initialBookmarked,
    (_state, next: boolean) => next,
  );

  function onClick() {
    // 더블 클릭 가드 — disabled 의 페인트 지연으로 두 번째 클릭이 새는 것을 막는다.
    if (isPending || toggle.isPending) return;
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await toggle.mutateAsync({ postId });
        // router.refresh 가 새 base 를 가져오므로 두 번째 setOptimistic 은 불필요.
        router.refresh();
      } catch {
        // 다음 RSC refresh 가 진실로 덮어쓴다.
      }
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending || toggle.isPending}
      className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      {optimistic ? "★ 북마크됨" : "☆ 북마크"}
    </button>
  );
}
