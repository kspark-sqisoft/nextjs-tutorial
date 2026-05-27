"use client";
// 학습 포인트: useOptimistic 의 토글 패턴 (단일 boolean).
// LikeButton 과 같은 이유로 mutation 후 router.refresh() 로 RSC base state 갱신.
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";

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
    if (isPending || toggle.isPending) return;
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await toggle.mutateAsync({ postId });
        router.refresh();
      } catch {
        // 다음 RSC refresh 가 진실로 덮어쓴다.
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={optimistic ? "default" : "outline"}
      onClick={onClick}
      disabled={isPending || toggle.isPending}
    >
      <span aria-hidden>{optimistic ? "★" : "☆"}</span>
      <span>{optimistic ? "북마크됨" : "북마크"}</span>
    </Button>
  );
}
