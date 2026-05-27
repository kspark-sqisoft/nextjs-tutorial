"use client";
// 검색 폼 — 타이핑을 멈추면 자동으로 검색 페이지로 이동 (디바운싱) + clear 버튼.
// 학습 포인트:
//  - 입력마다 setTimeout 을 등록하고, cleanup 으로 이전 타이머를 취소.
//  - router.replace 로 history 가 쌓이지 않게 (뒤로가기 한 번에 원위치).
//  - useTransition 으로 RSC 라우팅을 non-blocking 으로 묶어 input pending 표시.
//  - Enter (submit) 는 즉시 navigation — 디바운싱 우회.
//  - clear 버튼은 q 비우고 홈으로 이동 → 전체 글 그리드 노출.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DEBOUNCE_MS = 400;

export function SearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const t = useTranslations("search");
  const [q, setQ] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function navigate(next: string) {
    const trimmed = next.trim();
    // 빈 검색어 — 홈으로 가서 전체 글 그리드 노출.
    if (!trimmed) {
      startTransition(() => router.replace("/"));
      return;
    }
    const params = new URLSearchParams({ q: trimmed });
    startTransition(() => router.replace(`/search?${params.toString()}`));
  }

  // 디바운싱 — q 가 바뀐 뒤 사용자가 DEBOUNCE_MS 동안 가만 있으면 navigate.
  useEffect(() => {
    if (q.trim() === initial.trim()) return;
    const timer = setTimeout(() => navigate(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(q);
  }

  function onClear() {
    setQ("");
    navigate("");
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("placeholder")}
          aria-busy={isPending}
          className={q ? "pr-9" : undefined}
        />
        {q && (
          <button
            type="button"
            onClick={onClear}
            aria-label="검색어 지우기"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        {t("submit")}
      </Button>
    </form>
  );
}
