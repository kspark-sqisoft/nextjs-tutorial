"use client";
// 학습 포인트:
//  - useOptimistic 으로 클릭 즉시 UI 가 반영되고, 서버 응답이 오면 실제 값으로 sync.
//  - useOptimistic 의 base state 는 props 이므로, transition 종료 시점에는 base 로 reset.
//    따라서 mutation 성공 후 router.refresh() 로 RSC 를 다시 실행시켜 base 자체를 갱신해야
//    화면이 새 값을 유지한다 (안 그러면 잠깐 바뀌었다가 옛 값으로 돌아간다).
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
        await toggle.mutateAsync({ postId });
        // RSC 재실행 → bySlug 다시 fetch → useOptimistic base 갱신.
        // 두 번째 setOptimistic 으로 다시 sync 하지 않는다:
        // reducer 가 base 에서 누적 적용되므로 같은 action 을 한 번 더 보내면 count 가 또 ±1 된다.
        router.refresh();
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
