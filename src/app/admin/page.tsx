// 관리자 대시보드 — 단순 카운트.
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { posts, users } from "@/server/db/schema";

export default async function AdminDashboard() {
  const [{ userCount }] = (await db
    .select({ userCount: sql<number>`count(*)::int` })
    .from(users)) as [{ userCount: number }];
  const [{ postCount }] = (await db
    .select({ postCount: sql<number>`count(*)::int` })
    .from(posts)) as [{ postCount: number }];
  const [{ hiddenCount }] = (await db
    .select({ hiddenCount: sql<number>`count(*)::int` })
    .from(posts)
    .where(sql`is_hidden = true`)) as [{ hiddenCount: number }];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">대시보드</h1>
      <ul className="grid grid-cols-3 gap-3 text-sm">
        <li className="rounded border p-4">
          유저
          <strong className="block text-2xl">{userCount}</strong>
        </li>
        <li className="rounded border p-4">
          글
          <strong className="block text-2xl">{postCount}</strong>
        </li>
        <li className="rounded border p-4">
          숨김 글
          <strong className="block text-2xl">{hiddenCount}</strong>
        </li>
      </ul>
    </div>
  );
}
