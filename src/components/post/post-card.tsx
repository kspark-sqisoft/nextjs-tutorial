// 글 카드 — velog 스타일: cover 이미지 + 본문 영역 + 작성자 메타.
// 학습 포인트:
//  - cover 이미지가 있으면 16:9 비율로 상단에 배치, 없으면 카테고리 액센트 bar.
//  - next/image 의 fill + object-cover 로 어떤 비율의 원본도 일관된 모양으로.
//  - PostLink 가 View Transitions 로 카드 → 상세 morph (post-<id> 키 일치).
import Image from "next/image";
import { PostLink } from "./post-link";
import { formatKoDateTime } from "@/lib/format";

// 카테고리별 위쪽 액센트 — 이미지가 없는 카드에 시각적 변화를 주기 위한 미세 장식.
const categoryAccent: Record<string, string> = {
  일반: "from-sky-400/70 to-indigo-400/70",
  학습: "from-emerald-400/70 to-teal-400/70",
  회고: "from-amber-400/70 to-rose-400/70",
};

function pickAccent(name?: string | null) {
  if (name && categoryAccent[name]) return categoryAccent[name];
  return "from-foreground/30 to-foreground/10";
}

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
    coverImageUrl?: string | null;
  };
}) {
  const accent = pickAccent(post.categoryName);
  const hasCover = !!post.coverImageUrl;
  return (
    <PostLink
      href={`/posts/${encodeURIComponent(post.slug)}`}
      viewTransitionName={`post-${post.id}`}
      className="group relative flex h-full flex-col overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]"
    >
      {hasCover ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <Image
            src={post.coverImageUrl!}
            alt=""
            fill
            unoptimized
            // loading="eager" — next/image 기본값 lazy 를 끈다.
            // 뒤로가기 시 페이지가 리마운트되면 lazy 로딩 사이클이 다시 돌아
            // "빈 칸 → 페인트" 한 프레임(=깜빡임)이 생긴다. eager 면 캐시(immutable)에서
            // 즉시 그려져 깜빡임이 사라진다. (본문 이미지는 순수 <img> 라 원래 안 깜빡임)
            loading="eager"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <span
          aria-hidden
          className={`block h-[3px] w-full bg-gradient-to-r ${accent}`}
        />
      )}

      <div className="flex flex-1 flex-col gap-3 p-6">
        {post.categoryName && (
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {post.categoryName}
          </span>
        )}
        <h3 className="line-clamp-2 text-xl font-semibold leading-snug tracking-tight transition-colors group-hover:text-foreground">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border/50 px-6 py-4 text-xs text-muted-foreground">
        {post.authorAvatarUrl ? (
          <Image
            src={post.authorAvatarUrl}
            width={24}
            height={24}
            alt=""
            unoptimized
            // 커버와 같은 이유로 lazy 끄기 — 리마운트 시 깜빡임 방지.
            loading="eager"
            className="size-6 rounded-full object-cover ring-1 ring-border/60"
          />
        ) : (
          <div className="size-6 rounded-full bg-muted ring-1 ring-border/60" />
        )}
        <span className="font-medium text-foreground">
          {post.authorNickname}
        </span>
        <time className="ml-auto tabular-nums">
          {formatKoDateTime(post.createdAt)}
        </time>
      </div>
    </PostLink>
  );
}
