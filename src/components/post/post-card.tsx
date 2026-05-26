// 글 카드 — RSC 친화 (클라이언트 코드 없음).
import Link from "next/link";
import Image from "next/image";

export function PostCard({
  post,
}: {
  post: {
    title: string;
    slug: string;
    createdAt: Date;
    authorNickname: string;
    authorAvatarUrl: string | null;
  };
}) {
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="block rounded-lg border p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <h3 className="text-lg font-semibold">{post.title}</h3>
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
        {post.authorAvatarUrl && (
          <Image
            src={post.authorAvatarUrl}
            width={20}
            height={20}
            alt=""
            unoptimized
            className="size-5 rounded-full object-cover"
          />
        )}
        <span>{post.authorNickname}</span>
        <span>·</span>
        <time>{new Date(post.createdAt).toLocaleString("ko-KR")}</time>
      </div>
    </Link>
  );
}
