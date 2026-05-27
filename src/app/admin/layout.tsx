// 학습 포인트: 권한 부족은 redirect 보다 notFound 가 정보 누출이 적다.
// (악의적 사용자가 /admin 의 존재 자체를 알기 어렵게.)
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") return notFound();
  return (
    <div className="mx-auto flex max-w-5xl gap-6 p-8">
      <aside className="w-48 shrink-0">
        <h2 className="mb-4 text-sm font-medium text-zinc-500">관리자</h2>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/admin"
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            대시보드
          </Link>
          <Link
            href="/admin/users"
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            유저
          </Link>
          <Link
            href="/admin/posts"
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            글
          </Link>
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
