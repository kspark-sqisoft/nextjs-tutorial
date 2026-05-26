// /me/bookmarks — 내 북마크 목록 (RSC).
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/current-user";
import { createCaller } from "@/server/trpc/caller";
import { PostCard } from "@/components/post/post-card";

export default async function MyBookmarksPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  const caller = await createCaller();
  const items = await caller.bookmark.myBookmarks();
  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">내 북마크</h1>
        <Link href="/me" className="text-sm underline">
          ← 프로필
        </Link>
      </header>
      <div className="flex flex-col gap-3">
        {items.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {!items.length && (
          <p className="text-sm text-zinc-500">아직 북마크가 없습니다.</p>
        )}
      </div>
    </main>
  );
}
