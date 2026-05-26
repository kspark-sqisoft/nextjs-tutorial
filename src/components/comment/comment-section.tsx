// Suspense 경계 — 폼은 즉시, 목록은 streaming 으로 후행 표시.
// 학습 포인트: RSC 안의 Suspense fallback 은 SSR streaming 으로 즉시 렌더된다.
import { Suspense } from "react";
import { CommentList } from "./comment-list";
import { CommentForm } from "./comment-form";

export function CommentSection({
  postId,
  canPost,
}: {
  postId: string;
  canPost: boolean;
}) {
  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="mb-4 text-lg font-semibold">댓글</h2>
      {canPost ? (
        <CommentForm postId={postId} />
      ) : (
        <p className="text-sm text-zinc-500">
          댓글 작성은 로그인 후 가능합니다.
        </p>
      )}
      <Suspense fallback={<CommentSkeleton />}>
        <CommentList postId={postId} />
      </Suspense>
    </section>
  );
}

function CommentSkeleton() {
  return (
    <div className="mt-4 animate-pulse text-sm text-zinc-400">
      댓글 불러오는 중…
    </div>
  );
}
