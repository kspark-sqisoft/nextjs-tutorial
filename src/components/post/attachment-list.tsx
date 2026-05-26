"use client";
// 첨부 영역 — 파일 선택 → presigned PUT → confirmAttachment → 부모에 objectKey 전달.
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { UPLOAD_CONSTRAINTS } from "@/server/storage/constraints";

export function AttachmentList({
  attachmentKeys,
  onAdded,
}: {
  attachmentKeys: string[];
  onAdded: (objectKey: string) => void;
}) {
  const requestUpload = trpc.post.requestAttachmentUpload.useMutation();
  const confirmUpload = trpc.post.confirmAttachment.useMutation();
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const c = UPLOAD_CONSTRAINTS.POST_ATTACHMENT;
    if (!c.mimeWhitelist.has(file.type))
      return setError("허용되지 않는 형식입니다.");
    if (file.size > c.maxBytes)
      return setError(`${c.maxBytes / 1024 / 1024}MB 이하만 가능합니다.`);
    try {
      const { uploadUrl, objectKey, headers } =
        await requestUpload.mutateAsync({
          kind: "POST_ATTACHMENT",
          mime: file.type,
          sizeBytes: file.size,
        });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: file,
      });
      if (!res.ok) return setError(`업로드 실패 (${res.status})`);
      await confirmUpload.mutateAsync({
        kind: "POST_ATTACHMENT",
        objectKey,
        originalName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      onAdded(objectKey);
      e.target.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    }
  }

  return (
    <div className="rounded border p-3">
      <div className="mb-2 text-sm font-medium">첨부 파일</div>
      <ul className="mb-2 list-disc pl-5 text-xs text-zinc-600">
        {attachmentKeys.map((k) => (
          <li key={k}>{k.split("/").pop()}</li>
        ))}
        {!attachmentKeys.length && (
          <li className="list-none text-zinc-400">아직 없음</li>
        )}
      </ul>
      <label className="cursor-pointer text-sm text-blue-600 underline">
        파일 추가
        <input type="file" onChange={onPick} className="hidden" />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
