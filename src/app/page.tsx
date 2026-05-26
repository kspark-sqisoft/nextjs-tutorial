// 홈 — 최근 글 피드 (RSC).
// 무한 스크롤/검색/Suspense + Hydration 전환은 M7 에서.
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/current-user";
import { createCaller } from "@/server/trpc/caller";
import { PostCard } from "@/components/post/post-card";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function HomePage() {
  const me = await getCurrentUser();
  const caller = await createCaller();
  const { items } = await caller.post.list({ limit: 10 });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">학습용 블로그</h1>
          <span className="text-xs text-zinc-500">최근 글</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {me ? (
            <>
              <span className="text-zinc-500">
                👋 <strong>{me.nickname}</strong>
              </span>
              <Link href="/me" className="underline">
                프로필
              </Link>
              <Link
                href="/posts/new"
                className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                글쓰기
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="underline">
                로그인
              </Link>
              <Link href="/sign-up" className="underline">
                회원가입
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {items.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {!items.length && (
          <p className="text-sm text-zinc-500">아직 글이 없습니다.</p>
        )}
      </div>
    </main>
  );
}
