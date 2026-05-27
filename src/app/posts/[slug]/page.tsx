// 글 상세 — RSC. Tiptap JSON 을 서버에서 안전한 HTML 로 렌더.
// Apple 톤: 큰 hero 헤더 (text-5xl) + 충분한 여백.
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createCaller } from "@/server/trpc/caller";
import { renderTiptapToSafeHtml } from "@/server/posts/sanitize";
import { getCurrentUser } from "@/server/auth/current-user";
import { LikeButton } from "@/components/post/like-button";
import { BookmarkButton } from "@/components/post/bookmark-button";
import { CommentSection } from "@/components/comment/comment-section";
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
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      {/* Hero 헤더 — viewTransitionName 이 카드의 PostLink 와 매칭되어 morph. */}
      <header
        className="mb-14"
        style={{ viewTransitionName: `post-${post.id}` }}
      >
        {post.categoryName && post.categorySlug && (
          <Link
            href={`/categories/${encodeURIComponent(post.categorySlug)}`}
            className="mb-5 inline-block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            {post.categoryName}
          </Link>
        )}
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
          {post.title}
        </h1>

        {/* 메타 — 아바타 + 닉네임 + 날짜. */}
        <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
          {post.authorAvatarUrl ? (
            <Image
              src={post.authorAvatarUrl}
              width={36}
              height={36}
              alt=""
              unoptimized
              className="size-9 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="size-9 rounded-full bg-muted ring-1 ring-border" />
          )}
          <span className="font-medium text-foreground">
            {post.authorNickname}
          </span>
          <span className="text-border">·</span>
          <time className="tabular-nums">
            {formatKoDateTime(post.createdAt)}
          </time>
        </div>

        {post.tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/tags/${encodeURIComponent(t.slug)}`}
                  className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                >
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {me && (
          <div className="mt-8 flex gap-2">
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

      {/* 본문 + 이미지 prose 톤.
          학습 포인트:
           - prose-img:my-10 — 이미지 위아래 충분한 여백 (연속 이미지 사이 collapse 되어 자연스러운 간격).
           - prose-img:rounded-none — 카드 톤과 맞춰 각진 모서리.
           - prose-img:shadow-md ring-1 — 가벼운 그림자 + 미세한 ring 으로 floating 톤.
           - prose-img:w-full prose-img:object-cover — 카드 너비에 균일하게. */}
      <article
        className="prose prose-zinc prose-lg max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-foreground prose-a:underline-offset-4 hover:prose-a:opacity-80 prose-img:my-10 prose-img:w-full prose-img:rounded-none prose-img:shadow-md prose-img:ring-1 prose-img:ring-black/5 dark:prose-img:ring-white/10 prose-p:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {post.attachments.length > 0 && (
        <section className="mt-14 rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            첨부 파일
          </h2>
          <ul className="space-y-2 text-sm">
            {post.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span aria-hidden>📎</span>
                <a
                  href={a.url}
                  className="text-foreground underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.originalName}
                </a>
                <span className="text-xs text-muted-foreground">
                  {Math.round(a.sizeBytes / 1024)} KB
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <nav className="mt-10 flex gap-2">
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
        className="mt-16 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <span aria-hidden>←</span> 목록으로
      </Link>
    </main>
  );
}
