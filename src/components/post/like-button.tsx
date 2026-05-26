"use client";
// 학습 포인트: useOptimistic 으로 클릭 즉시 UI 가 반영되고,
// 서버 응답이 오면 실제 값으로 sync. 실패 시 다음 RSC refresh 가 진실로 덮어쓴다.
import { useOptimistic, useTransition } from "react";
import { trpc } from "@/lib/trpc-client";

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const toggle = trpc.like.toggle.useMutation();
  const [isPending, startTransition] = useTransition();

  // 단일 객체로 묶어두면 두 필드를 한 번에 낙관적으로 변경 가능.
  const [optimistic, setOptimistic] = useOptimistic(
    { liked: initialLiked, count: initialCount },
    (state, action: { liked: boolean }) => ({
      liked: action.liked,
      count: state.count + (action.liked ? 1 : -1),
    }),
  );

  function onClick() {
    // 더블 클릭 가드 — button 의 disabled 는 React 가 다음 페인트에 반영하므로
    // 빠른 두 번째 클릭이 mutation 을 한 번 더 디스패치할 수 있다.
    if (isPending || toggle.isPending) return;
    const next = !optimistic.liked;
    startTransition(async () => {
      setOptimistic({ liked: next });
      try {
        const r = await toggle.mutateAsync({ postId });
        // 서버 응답으로 sync — 동시 다발 클릭 시 카운트 정합성 보장.
        setOptimistic({ liked: r.liked });
      } catch {
        // 실패 시 다음 RSC refresh 가 진실로 덮어쓴다.
      }
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending || toggle.isPending}
      className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <span>{optimistic.liked ? "♥" : "♡"}</span>
      <span>{optimistic.count}</span>
    </button>
  );
}
