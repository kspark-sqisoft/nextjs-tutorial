// 글 상세 — RSC. Tiptap JSON 을 서버에서 안전한 HTML 로 렌더.
import { notFound } from "next/navigation";
import Link from "next/link";
import { createCaller } from "@/server/trpc/caller";
import { renderTiptapToSafeHtml } from "@/server/posts/sanitize";
import { getCurrentUser } from "@/server/auth/current-user";
import { LikeButton } from "@/components/post/like-button";
import { BookmarkButton } from "@/components/post/bookmark-button";
import { CommentSection } from "@/components/comment/comment-section";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await createCaller();
  let post;
  try {
    post = await caller.post.bySlug({ slug });
  } catch {
    return notFound();
  }
  const me = await getCurrentUser();
  const canEdit =
    me && (me.id === post.authorId || me.role === "ADMIN");

  const html = renderTiptapToSafeHtml(post.contentJson);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">{post.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {post.authorNickname} ·{" "}
          {new Date(post.createdAt).toLocaleString("ko-KR")}
          {post.categoryName && (
            <>
              {" · "}
              <Link
                href={`/`}
                className="underline"
                title="카테고리 페이지는 M7 에서 추가"
              >
                📁 {post.categoryName}
              </Link>
            </>
          )}
        </p>
        {post.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1 text-xs">
            {post.tags.map((t) => (
              <li
                key={t.slug}
                className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900"
              >
                #{t.name}
              </li>
            ))}
          </ul>
        )}
        {me && (
          <div className="mt-4 flex gap-2">
            <LikeButton
              postId={post.id}
              initialLiked={post.liked}
              initialCount={post.likeCount}
            />
            <BookmarkButton
              postId={post.id}
              initialBookmarked={post.bookmarked}
            />
          </div>
        )}
      </header>

      <article
        className="prose max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {post.attachments.length > 0 && (
        <section className="mt-8 border-t pt-4">
          <h2 className="mb-2 text-sm font-medium">첨부 파일</h2>
          <ul className="list-disc pl-5 text-sm">
            {post.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  className="text-blue-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.originalName}
                </a>{" "}
                <span className="text-xs text-zinc-400">
                  ({Math.round(a.sizeBytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <nav className="mt-8 flex gap-4 text-sm">
          <Link href={`/posts/${post.slug}/edit`} className="underline">
            수정
          </Link>
        </nav>
      )}

      <CommentSection postId={post.id} canPost={!!me} />

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-zinc-500 underline"
      >
        ← 목록으로
      </Link>
    </main>
  );
}
