"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const t = useTranslations("search");
  const [q, setQ] = useState(initial);
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ q });
    router.push(`/search?${params.toString()}`);
  }
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("placeholder")}
      />
      <Button type="submit">{t("submit")}</Button>
    </form>
  );
}
