// 글 카드 — 그리드용 디자인. RSC 친화 (클라이언트 코드 없음).
// 학습 포인트: line-clamp 로 제목/본문 truncate, Card 로 통일된 톤.
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKoDateTime } from "@/lib/format";

export function PostCard({
  post,
}: {
  post: {
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
      <Link
        href={`/posts/${encodeURIComponent(post.slug)}`}
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
      </Link>
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
