// 글 상세 — RSC. Tiptap JSON 을 서버에서 안전한 HTML 로 렌더.
import { notFound } from "next/navigation";
import Link from "next/link";
import { createCaller } from "@/server/trpc/caller";
import { renderTiptapToSafeHtml } from "@/server/posts/sanitize";
import { getCurrentUser } from "@/server/auth/current-user";
import { LikeButton } from "@/components/post/like-button";
import { BookmarkButton } from "@/components/post/bookmark-button";
import { CommentSection } from "@/components/comment/comment-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKoDateTime } from "@/lib/format";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const caller = await createCaller();
  let post;
  try {
    post = await caller.post.bySlug({ slug });
  } catch (e) {
    console.error("[posts/[slug]] bySlug failed:", slug, e);
    return notFound();
  }
  const me = await getCurrentUser();
  const canEdit =
    me && (me.id === post.authorId || me.role === "ADMIN");

  const html = renderTiptapToSafeHtml(post.contentJson);
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* 헤더 — velog 톤: 카테고리 뱃지 → 큰 제목 → 메타 한 줄 → 태그 칩 → 액션 */}
      {/* viewTransitionName 은 카드의 PostLink 와 동일한 키 (`post-<id>`) — 두 페이지 사이 morph. */}
      <header
        className="mb-10 border-b pb-8"
        style={{ viewTransitionName: `post-${post.id}` }}
      >
        {post.categoryName && post.categorySlug && (
          <Link
            href={`/categories/${encodeURIComponent(post.categorySlug)}`}
            className="mb-3 inline-block"
          >
            <Badge variant="secondary">📁 {post.categoryName}</Badge>
          </Link>
        )}
        <h1 className="mb-3 text-3xl font-bold leading-tight md:text-4xl">
          {post.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {post.authorNickname}
          </span>
          {" · "}
          <time>{formatKoDateTime(post.createdAt)}</time>
        </p>
        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <li key={t.slug}>
                <Link href={`/tags/${encodeURIComponent(t.slug)}`}>
                  <Badge variant="outline" className="hover:bg-muted">
                    #{t.name}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {me && (
          <div className="mt-6 flex gap-2">
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
        className="prose prose-zinc max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {post.attachments.length > 0 && (
        <section className="mt-10 rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-medium">첨부 파일</h2>
          <ul className="space-y-1 text-sm">
            {post.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span>📎</span>
                <a
                  href={a.url}
                  className="text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.originalName}
                </a>
                <span className="text-xs text-muted-foreground">
                  ({Math.round(a.sizeBytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <nav className="mt-8 flex gap-2">
          <Link href={`/posts/${encodeURIComponent(post.slug)}/edit`}>
            <Button variant="outline" size="sm">
              수정
            </Button>
          </Link>
        </nav>
      )}

      <CommentSection postId={post.id} canPost={!!me} />

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← 목록으로
      </Link>
    </main>
  );
}
