// /admin/posts — 글 목록 + 숨김/삭제.
import { createCaller } from "@/server/trpc/caller";
import { PostRow } from "@/components/admin/post-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; onlyHidden?: string }>;
}) {
  const sp = await searchParams;
  const caller = await createCaller();
  const rows = await caller.admin.posts.list({
    q: sp.q?.trim() || undefined,
    onlyHidden: sp.onlyHidden === "1",
  });
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">글</h1>
      <form className="mb-4 flex items-center gap-2">
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="제목 검색"
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="onlyHidden"
            value="1"
            defaultChecked={sp.onlyHidden === "1"}
          />
          숨김만
        </label>
        <Button type="submit" size="sm">
          검색
        </Button>
      </form>
      <ul className="flex flex-col divide-y">
        {rows.map((p) => (
          <PostRow key={p.id} post={p} />
        ))}
        {!rows.length && (
          <li className="py-4 text-sm text-zinc-500">결과 없음</li>
        )}
      </ul>
    </div>
  );
}
