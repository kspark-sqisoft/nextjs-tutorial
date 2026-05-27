// 글 카드 — 그리드용 디자인. RSC + 클라이언트 PostLink 조합.
// 학습 포인트:
//  - line-clamp 로 제목/본문 truncate, Card 로 통일된 톤.
//  - PostLink 가 View Transitions API 로 카드→상세 모핑을 트리거.
//  - viewTransitionName 은 post.id 기반으로 카드/상세 양쪽이 일치해야 morph.
import Image from "next/image";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostLink } from "./post-link";
import { formatKoDateTime } from "@/lib/format";

export function PostCard({
  post,
}: {
  post: {
    id: string;
    title: string;
    slug: string;
    createdAt: Date;
    authorNickname: string;
    authorAvatarUrl: string | null;
    excerpt?: string;
    categorySlug?: string | null;
    categoryName?: string | null;
  };
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0 transition hover:shadow-md">
      <PostLink
        href={`/posts/${encodeURIComponent(post.slug)}`}
        viewTransitionName={`post-${post.id}`}
        className="flex flex-1 flex-col"
      >
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          {post.categoryName && (
            <Badge variant="secondary" className="w-fit">
              📁 {post.categoryName}
            </Badge>
          )}
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {post.excerpt}
            </p>
          )}
        </CardContent>
      </PostLink>
      <CardFooter className="border-t p-4">
        <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
          {post.authorAvatarUrl ? (
            <Image
              src={post.authorAvatarUrl}
              width={24}
              height={24}
              alt=""
              unoptimized
              className="size-6 rounded-full object-cover"
            />
          ) : (
            <div className="size-6 rounded-full bg-muted" />
          )}
          <span className="font-medium text-foreground">
            {post.authorNickname}
          </span>
          <time className="ml-auto">{formatKoDateTime(post.createdAt)}</time>
        </div>
      </CardFooter>
    </Card>
  );
}
