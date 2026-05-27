"use client";
// 학습 포인트: useOptimistic 의 리스트 추가 패턴.
// 폼 제출 즉시 임시 항목을 보여주고, 서버 응답 후 router.refresh() 가
// RSC CommentList 를 다시 fetch 해 진짜 데이터로 덮어쓴다.
import { useOptimistic, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface PendingItem {
  tempId: string;
  content: string;
}

export function CommentForm({
  postId,
  parentId,
  onPosted,
}: {
  postId: string;
  parentId?: string;
  onPosted?: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const create = trpc.comment.create.useMutation();
  const [isPending, startTransition] = useTransition();

  const [pending, addOptimistic] = useOptimistic<
    PendingItem[],
    PendingItem
  >([], (state, action) => [...state, action]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = ref.current?.value.trim() ?? "";
    if (!content) return;
    const tempId = crypto.randomUUID();
    startTransition(async () => {
      addOptimistic({ tempId, content });
      if (ref.current) ref.current.value = "";
      try {
        await create.mutateAsync({ postId, parentId, content });
        router.refresh();
        onPosted?.();
      } catch (err) {
        // 실패 시 router.refresh 가 진실로 덮어쓰고 useOptimistic 항목은 사라진다.
        console.error(err);
      }
    });
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Textarea
          ref={ref}
          required
          maxLength={1000}
          placeholder="댓글을 남겨주세요"
          rows={2}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending}>
          작성
        </Button>
      </form>
      {pending.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pending.map((p) => (
            <li
              key={p.tempId}
              className="rounded border border-dashed px-3 py-2 text-xs text-zinc-400"
            >
              ⏳ {p.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
