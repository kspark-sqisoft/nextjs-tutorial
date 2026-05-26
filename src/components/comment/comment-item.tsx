"use client";
// 클라이언트: 삭제(트랜지션) + 답글 입력 토글.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { trpc } from "@/lib/trpc-client";
import { formatKoDateTime } from "@/lib/format";
import { CommentForm } from "./comment-form";

export interface CommentDTO {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
}

export function CommentItem({
  comment,
  replies,
  postId,
  canPost,
  myId,
  isAdmin,
}: {
  comment: CommentDTO;
  replies: CommentDTO[];
  postId: string;
  canPost: boolean;
  myId: string | null;
  isAdmin: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const del = trpc.comment.delete.useMutation();
  const canDelete =
    !!myId && (myId === comment.authorId || isAdmin);

  function onDelete() {
    if (!confirm("댓글을 삭제하시겠어요?")) return;
    startTransition(async () => {
      await del.mutateAsync({ id: comment.id });
      router.refresh();
    });
  }

  return (
    <li>
      <article className="flex gap-3">
        {comment.authorAvatarUrl ? (
          <Image
            src={comment.authorAvatarUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="size-8 rounded-full bg-zinc-200" />
        )}
        <div className="flex-1">
          <header className="flex items-baseline gap-2 text-xs text-zinc-500">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {comment.authorNickname}
            </span>
            <time>{formatKoDateTime(comment.createdAt)}</time>
          </header>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {comment.content}
          </p>
          <div className="mt-2 flex gap-3 text-xs text-zinc-500">
            {canPost && comment.parentId === null && (
              <button
                onClick={() => setReplying((p) => !p)}
                className="underline"
              >
                답글
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={isPending}
                className="underline"
              >
                삭제
              </button>
            )}
          </div>
          {replying && (
            <div className="mt-2">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onPosted={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </article>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-3 border-l pl-10">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              replies={[]}
              postId={postId}
              canPost={canPost}
              myId={myId}
              isAdmin={isAdmin}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
