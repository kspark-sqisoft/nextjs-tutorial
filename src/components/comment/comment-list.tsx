// RSC. Suspense fallback 동안 fetch 되고 streaming 으로 본문 뒤에 합쳐진다.
import { createCaller } from "@/server/trpc/caller";
import { getCurrentUser } from "@/server/auth/current-user";
import { CommentItem, type CommentDTO } from "./comment-item";

export async function CommentList({ postId }: { postId: string }) {
  const caller = await createCaller();
  const all = await caller.comment.listByPost({ postId });
  const me = await getCurrentUser();
  const canPost = !!me;
  const myId = me?.id ?? null;
  const isAdmin = me?.role === "ADMIN";

  // 1단계 트리 — 부모만 추출, 자식들은 grouping.
  const roots = all.filter((c) => !c.parentId);
  const children = new Map<string, CommentDTO[]>();
  for (const c of all) {
    if (c.parentId) {
      const list = children.get(c.parentId) ?? [];
      list.push(c);
      children.set(c.parentId, list);
    }
  }
  if (roots.length === 0)
    return (
      <p className="mt-4 text-sm text-zinc-400">
        첫 댓글을 남겨보세요.
      </p>
    );
  return (
    <ul className="mt-4 space-y-4">
      {roots.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          replies={children.get(c.id) ?? []}
          postId={postId}
          canPost={canPost}
          myId={myId}
          isAdmin={isAdmin}
        />
      ))}
    </ul>
  );
}
