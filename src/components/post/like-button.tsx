"use client";
// 학습 포인트:
//  - useOptimistic 으로 클릭 즉시 UI 가 반영되고, 서버 응답이 오면 실제 값으로 sync.
//  - useOptimistic 의 base state 는 props 이므로, transition 종료 시점에는 base 로 reset.
//    따라서 mutation 성공 후 router.refresh() 로 RSC 를 다시 실행시켜 base 자체를 갱신해야
//    화면이 새 값을 유지한다 (안 그러면 잠깐 바뀌었다가 옛 값으로 돌아간다).
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
  canInteract = true,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  // 비로그인 사용자도 좋아요 "숫자"는 봐야 하므로 버튼 자체는 항상 렌더링하고,
  // canInteract=false 일 때만 토글(클릭)을 막는다.
  canInteract?: boolean;
}) {
  const router = useRouter();
  const toggle = trpc.like.toggle.useMutation();
  const [isPending, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    { liked: initialLiked, count: initialCount },
    (state, action: { liked: boolean }) => ({
      liked: action.liked,
      count: state.count + (action.liked ? 1 : -1),
    }),
  );

  function onClick() {
    // 비로그인 사용자는 숫자만 보고 토글은 불가.
    if (!canInteract) return;
    // 더블 클릭 가드 — disabled 의 페인트 지연으로 두 번째 클릭이 새는 것을 막는다.
    if (isPending || toggle.isPending) return;
    const next = !optimistic.liked;
    startTransition(async () => {
      setOptimistic({ liked: next });
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
      variant={optimistic.liked ? "default" : "outline"}
      onClick={onClick}
      // 비로그인 시엔 disabled 로 흐리게 만들지 않는다(숫자 가독성 유지).
      // 대신 클릭 가드 + aria/cursor 로 "누를 수 없음"만 표현.
      disabled={canInteract ? isPending || toggle.isPending : undefined}
      aria-disabled={!canInteract}
      title={canInteract ? undefined : "로그인 후 좋아요를 누를 수 있어요"}
      className={canInteract ? undefined : "cursor-not-allowed"}
    >
      <span aria-hidden>{optimistic.liked ? "♥" : "♡"}</span>
      <span className="tabular-nums">{optimistic.count}</span>
    </Button>
  );
}
