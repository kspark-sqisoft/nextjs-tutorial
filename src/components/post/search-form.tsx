"use client";
// 검색창 — submit 시 /search?q=... 로 라우팅.
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ q });
    router.push(`/search?${params.toString()}`);
  }
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="검색어…"
        className="flex-1 rounded border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-zinc-900 px-4 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        검색
      </button>
    </form>
  );
}
