"use client";
// Tiptap 에디터 래퍼. content 는 JSON 으로 부모와 동기화.
// 학습 포인트:
//  - useEditor 의 onUpdate 에서 JSON 을 부모로 끌어올린다.
//  - upload 콜백은 presigned PUT → MinIO 직업로드 → confirm → 부모에게 attachmentKey 전달.
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc-client";
import { createUploadImageExtension } from "./upload-image-extension";

export interface TiptapEditorProps {
  value: unknown;
  onChange: (
    json: unknown,
    opts: { addedAttachmentKey?: string },
  ) => void;
}

export function TiptapEditor({ value, onChange }: TiptapEditorProps) {
  const requestUpload = trpc.post.requestAttachmentUpload.useMutation();
  const confirmUpload = trpc.post.confirmAttachment.useMutation();

  const upload = useCallback(
    async (file: File) => {
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
      if (!res.ok) throw new Error(`업로드 실패 (${res.status})`);
      const { url } = await confirmUpload.mutateAsync({
        kind: "POST_INLINE",
        objectKey,
        originalName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      onChange(value, { addedAttachmentKey: objectKey });
      return { src: url };
    },
    [requestUpload, confirmUpload, onChange, value],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "본문을 작성하세요…" }),
      createUploadImageExtension(upload),
    ],
    content: value as object,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON(), {}),
  });

  // 외부에서 value 가 reset 될 때 동기화 (예: 폼 초기화).
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(value))
      editor.commands.setContent(value as object);
  }, [value, editor]);

  return (
    <div className="rounded border p-3">
      <EditorContent
        editor={editor}
        className="prose min-h-[200px] max-w-none dark:prose-invert"
      />
    </div>
  );
}
