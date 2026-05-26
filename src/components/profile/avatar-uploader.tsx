"use client";
// 1) tRPC requestAvatarUpload 로 presigned URL 받기
// 2) 받은 URL 로 브라우저가 MinIO 에 PUT
// 3) tRPC confirmAvatar 로 attachments INSERT + users.avatar_key 갱신
// 4) router.refresh() 로 RSC 재실행 → 새 아바타 노출
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { trpc } from "@/lib/trpc-client";
import { UPLOAD_CONSTRAINTS } from "@/server/storage/constraints";

export function AvatarUploader({
  initialUrl,
}: {
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const requestUpload = trpc.profile.requestAvatarUpload.useMutation();
  const confirmAvatar = trpc.profile.confirmAvatar.useMutation();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const c = UPLOAD_CONSTRAINTS.AVATAR;
    if (!c.mimeWhitelist.has(file.type))
      return setError("jpg/png/webp 만 업로드 가능합니다.");
    if (file.size > c.maxBytes)
      return setError("2MB 이하 파일만 가능합니다.");

    setUploading(true);
    try {
      const { uploadUrl, objectKey, headers } =
        await requestUpload.mutateAsync({
          mime: file.type,
          sizeBytes: file.size,
        });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: file,
      });
      if (!res.ok) throw new Error(`업로드 실패 (${res.status})`);
      const { avatarUrl } = await confirmAvatar.mutateAsync({
        objectKey,
        originalName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      setPreviewUrl(avatarUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="size-20 overflow-hidden rounded-full border bg-zinc-100">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="avatar"
            width={80}
            height={80}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-zinc-400">
            No Image
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer rounded border px-3 py-1 text-sm">
          {uploading ? "업로드 중..." : "이미지 선택"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onChange}
            disabled={uploading}
          />
        </label>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
