"use client";
// 글 작성/수정 폼. tRPC mutation 으로 저장 후 상세 페이지로 이동.
// 학습 포인트:
//  - 본문 contentJson 안의 image 노드는 별도 ImageGallery 에서 관리 (분리/추가/삭제).
//  - submit 시 contentJson = [image 노드들, ...본문] 형태로 합성 → list 쿼리의 cover 추출이
//    첫 image src 를 그대로 가져갈 수 있다.
//  - 새로 업로드한 이미지의 objectKey 는 attachmentKeys 로 전달 → post 트랜잭션이 post_id 매핑.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { AttachmentList } from "./attachment-list";
import { ImageGallery, type GalleryItem } from "./image-gallery";
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

type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
};

// contentJson 을 (이미지 노드들, 그 외 본문 노드들) 두 갈래로 분리.
// 학습 포인트: 트리를 한 번만 훑어서 image 만 골라낸다 (한 단계만 — 그 이상은 본문 그대로).
function splitImages(json: unknown): {
  images: GalleryItem[];
  body: TiptapNode;
} {
  const doc = (json ?? { type: "doc", content: [] }) as TiptapNode;
  const content = Array.isArray(doc.content) ? doc.content : [];
  const images: GalleryItem[] = [];
  const others: TiptapNode[] = [];
  for (const n of content) {
    if (n.type === "image") {
      const src = (n.attrs?.src as string | undefined) ?? "";
      if (src) images.push({ url: src });
    } else {
      others.push(n);
    }
  }
  return {
    images,
    body: { type: doc.type ?? "doc", content: others },
  };
}

export function PostForm({ mode, initial }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");

  // 분리: image 노드는 ImageGallery 가, 그 외 본문은 Tiptap 이 담당.
  const split = useMemo(() => splitImages(initial?.contentJson), [initial]);

  const [images, setImages] = useState<GalleryItem[]>(split.images);
  const [contentJson, setContentJson] = useState<TiptapNode>(
    split.body.content?.length
      ? split.body
      : { type: "doc", content: [{ type: "paragraph" }] },
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
  // 본문 외 일반 첨부 (POST_ATTACHMENT) 의 objectKey 모음.
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
    setContentJson(json as TiptapNode);
    // Tiptap 에디터가 drag/paste 로 이미지 업로드 시 — 본문에 이미 image 노드가 삽입됐을 것.
    // 단순화: 그 이미지는 본문 inline 으로 유지하고 갤러리에는 안 합쳐도 동작.
    // attachmentKey 만 모아 post_id 매핑 보장.
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

    // contentJson 합성 — image 노드들을 본문 맨 앞에 배치.
    const imageNodes: TiptapNode[] = images.map((it) => ({
      type: "image",
      attrs: { src: it.url, alt: null, title: null },
    }));
    const bodyContent = Array.isArray(contentJson.content)
      ? contentJson.content
      : [];
    const merged: TiptapNode = {
      type: contentJson.type ?? "doc",
      content: [...imageNodes, ...bodyContent],
    };

    // 새로 업로드한 이미지 objectKey + 일반 첨부 키 합집합.
    const newImageKeys = images
      .map((i) => i.newKey)
      .filter((k): k is string => !!k);
    const allKeys = Array.from(
      new Set([...attachmentKeys, ...newImageKeys]),
    );

    try {
      if (mode === "create") {
        const { slug } = await create.mutateAsync({
          title,
          contentJson: merged,
          categorySlug,
          tagSlugs,
          isPublished,
          attachmentKeys: allKeys,
        });
        router.push(`/posts/${slug}`);
      } else {
        const { slug } = await update.mutateAsync({
          id: initial!.id!,
          title,
          contentJson: merged,
          categorySlug,
          tagSlugs,
          isPublished,
          attachmentKeys: allKeys,
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

      <ImageGallery items={images} onChange={setImages} />

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
