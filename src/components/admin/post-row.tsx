"use client";
// 글 행 — 숨김 토글 (useOptimistic) + 삭제.
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";

interface PostDTO {
  id: string;
  title: string;
  slug: string;
  isHidden: boolean;
  isPublished: boolean;
  createdAt: Date;
  authorNickname: string;
  authorEmail: string;
}

export function PostRow({ post }: { post: PostDTO }) {
  const router = useRouter();
  const setHidden = trpc.admin.posts.setHidden.useMutation();
  const del = trpc.admin.posts.delete.useMutation();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    post.isHidden,
    (_s, n: boolean) => n,
  );

  function onToggle() {
    if (pending || setHidden.isPending) return;
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await setHidden.mutateAsync({ postId: post.id, isHidden: next });
        router.refresh();
      } catch (e) {
        console.error(e);
      }
    });
  }

  function onDelete() {
    if (pending || del.isPending) return;
    if (!confirm(`"${post.title}" 글을 삭제하시겠어요?`)) return;
    startTransition(async () => {
      await del.mutateAsync({ postId: post.id });
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 py-3 text-sm">
      <div className="flex-1">
        <Link
          href={`/posts/${encodeURIComponent(post.slug)}`}
          className="font-medium hover:underline"
        >
          {post.title}
        </Link>
        <div className="text-xs text-zinc-500">
          {post.authorNickname} · {post.authorEmail}
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={pending || setHidden.isPending}
        className="rounded border px-3 py-1 text-xs"
      >
        {optimistic ? "🙈 숨김" : "👀 공개"} (토글)
      </button>
      <button
        onClick={onDelete}
        disabled={pending || del.isPending}
        className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
      >
        삭제
      </button>
    </li>
  );
}
