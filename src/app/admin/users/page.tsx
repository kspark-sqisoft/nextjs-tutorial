// /admin/users — 유저 목록 + 활성 토글.
import { createCaller } from "@/server/trpc/caller";
import { UserRow } from "@/components/admin/user-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; onlyInactive?: string }>;
}) {
  const sp = await searchParams;
  const caller = await createCaller();
  const rows = await caller.admin.users.list({
    q: sp.q?.trim() || undefined,
    onlyInactive: sp.onlyInactive === "1",
  });
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">유저</h1>
      <form className="mb-4 flex items-center gap-2">
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="이메일 검색"
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="onlyInactive"
            value="1"
            defaultChecked={sp.onlyInactive === "1"}
          />
          비활성만
        </label>
        <Button type="submit" size="sm">
          검색
        </Button>
      </form>
      <ul className="flex flex-col divide-y">
        {rows.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
        {!rows.length && (
          <li className="py-4 text-sm text-zinc-500">결과 없음</li>
        )}
      </ul>
    </div>
  );
}
