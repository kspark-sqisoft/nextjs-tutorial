"use client";
// 글 작성/수정 폼. tRPC mutation 으로 저장 후 상세 페이지로 이동.
// 학습 포인트:
//  - Tiptap 의 onChange 가 본문 JSON 과 함께 새 attachmentKey 를 부모로 끌어올린다.
//  - 첨부 영역도 동일하게 attachmentKey 를 push.
//  - submit 시 attachmentKeys 배열을 함께 보내 post.create 트랜잭션이 attachments.post_id 를 채운다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { AttachmentList } from "./attachment-list";
import { trpc } from "@/lib/trpc-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface PostFormProps {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    title: string;
    contentJson: unknown;
    categorySlug: string | null;
    tagSlugs: string[];
    isPublished: boolean;
    attachmentObjectKeys?: string[];
  };
}

export function PostForm({ mode, initial }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [contentJson, setContentJson] = useState<unknown>(
    initial?.contentJson ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
  );
  const [categorySlug, setCategorySlug] = useState<string | null>(
    initial?.categorySlug ?? null,
  );
  const [tagInput, setTagInput] = useState(
    initial?.tagSlugs?.join(", ") ?? "",
  );
  const [isPublished, setIsPublished] = useState(
    initial?.isPublished ?? true,
  );
  const [attachmentKeys, setAttachmentKeys] = useState<string[]>(
    initial?.attachmentObjectKeys ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const categories = trpc.post.listCategories.useQuery();
  const create = trpc.post.create.useMutation();
  const update = trpc.post.update.useMutation();

  function onEditorChange(
    json: unknown,
    opts: { addedAttachmentKey?: string },
  ) {
    setContentJson(json);
    if (opts.addedAttachmentKey) {
      setAttachmentKeys((prev) =>
        prev.includes(opts.addedAttachmentKey!)
          ? prev
          : [...prev, opts.addedAttachmentKey!],
      );
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const tagSlugs = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      if (mode === "create") {
        const { slug } = await create.mutateAsync({
          title,
          contentJson,
          categorySlug,
          tagSlugs,
          isPublished,
          attachmentKeys,
        });
        router.push(`/posts/${slug}`);
      } else {
        const { slug } = await update.mutateAsync({
          id: initial!.id!,
          title,
          contentJson,
          categorySlug,
          tagSlugs,
          isPublished,
          attachmentKeys,
        });
        router.push(`/posts/${slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        required
        maxLength={120}
        className="text-lg font-semibold"
      />

      <div className="flex flex-wrap gap-3">
        <select
          value={categorySlug ?? ""}
          onChange={(e) => setCategorySlug(e.target.value || null)}
          className="rounded border bg-background px-3 py-2 text-sm"
        >
          <option value="">카테고리 없음</option>
          {categories.data?.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="태그 (쉼표 구분)"
          className="min-w-[150px] flex-1"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          공개
        </label>
      </div>

      <TiptapEditor value={contentJson} onChange={onEditorChange} />

      <AttachmentList
        attachmentKeys={attachmentKeys}
        onAdded={(k) => setAttachmentKeys((p) => [...p, k])}
      />

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={create.isPending || update.isPending}
        >
          {create.isPending || update.isPending ? "저장 중..." : "저장"}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
