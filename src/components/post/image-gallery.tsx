"use client";
// 글 작성/수정 폼에서 본문과 별도로 관리하는 이미지 갤러리.
// 학습 포인트:
//  - presigned PUT → confirmAttachment 흐름은 AttachmentList 와 동일하지만
//    kind=POST_INLINE 으로 고정 (이미지 전용).
//  - 부모는 URL 배열만 알면 contentJson 에 image 노드로 합성 가능.
//  - 새로 업로드한 이미지의 objectKey 는 별도로 모아 부모에게 전달 →
//    post.create / update 의 attachmentKeys 입력으로 들어가 post_id 매핑.
import { useState } from "react";
import Image from "next/image";
import { X, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { UPLOAD_CONSTRAINTS } from "@/server/storage/constraints";

export interface GalleryItem {
  url: string;
  // 새로 업로드한 항목만 objectKey 보유 — 기존 이미지는 attachments row 가 이미 매핑되어 있어 불필요.
  newKey?: string;
}

export function ImageGallery({
  items,
  onChange,
}: {
  items: GalleryItem[];
  onChange: (next: GalleryItem[]) => void;
}) {
  const requestUpload = trpc.post.requestAttachmentUpload.useMutation();
  const confirmUpload = trpc.post.confirmAttachment.useMutation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null);
    setBusy(true);

    const c = UPLOAD_CONSTRAINTS.POST_INLINE;
    const added: GalleryItem[] = [];
    try {
      for (const file of files) {
        if (!c.mimeWhitelist.has(file.type)) {
          setError(`허용되지 않는 형식: ${file.name}`);
          continue;
        }
        if (file.size > c.maxBytes) {
          setError(`${file.name} 은 ${c.maxBytes / 1024 / 1024}MB 초과`);
          continue;
        }
        const { uploadUrl, objectKey, headers } =
          await requestUpload.mutateAsync({
            kind: "POST_INLINE",
            mime: file.type,
            sizeBytes: file.size,
          });
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers,
          body: file,
        });
        if (!res.ok) {
          setError(`업로드 실패 (${res.status}): ${file.name}`);
          continue;
        }
        const confirmed = await confirmUpload.mutateAsync({
          kind: "POST_INLINE",
          objectKey,
          originalName: file.name,
          mime: file.type,
          sizeBytes: file.size,
        });
        added.push({ url: confirmed.url, newKey: objectKey });
      }
      if (added.length) onChange([...items, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded border border-border/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">이미지 ({items.length})</div>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <Plus className="size-4" />
          이미지 추가
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPick}
            disabled={busy}
            className="hidden"
          />
        </label>
      </div>

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it, idx) => (
            <li
              key={it.url}
              className="group relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted"
            >
              <Image
                src={it.url}
                alt=""
                fill
                unoptimized
                sizes="200px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="이미지 제거"
                className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 ring-1 ring-border transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="size-4" />
              </button>
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] font-medium text-background">
                  Cover
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          이미지가 없습니다. 첫 번째 이미지가 카드 cover 로 사용됩니다.
        </p>
      )}

      {busy && (
        <p className="mt-2 text-xs text-muted-foreground">업로드 중…</p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
