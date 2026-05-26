// Tiptap 의 Image 확장을 wrapping 해 드래그/붙여넣기 시 자동 업로드.
// 학습 포인트:
//  - prosemirror Plugin 으로 drop/paste 이벤트 가로채기.
//  - upload(file) 콜백은 부모(에디터 컴포넌트)가 트RPC presigned 흐름을 구현.
import Image from "@tiptap/extension-image";
import { Plugin } from "@tiptap/pm/state";

export interface UploadHandler {
  (file: File): Promise<{ src: string }>;
}

export function createUploadImageExtension(upload: UploadHandler) {
  return Image.extend({
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleDOMEvents: {
              drop(view, event) {
                const files = Array.from(
                  event.dataTransfer?.files ?? [],
                ).filter((f) => f.type.startsWith("image/"));
                if (!files.length) return false;
                event.preventDefault();
                files.forEach(async (file) => {
                  const { src } = await upload(file);
                  const { schema } = view.state;
                  const node = schema.nodes.image!.create({
                    src,
                    alt: file.name,
                  });
                  view.dispatch(view.state.tr.replaceSelectionWith(node));
                });
                return true;
              },
              paste(view, event) {
                const items = Array.from(event.clipboardData?.items ?? []);
                const images = items
                  .map((it) => (it.kind === "file" ? it.getAsFile() : null))
                  .filter(
                    (f): f is File => !!f && f.type.startsWith("image/"),
                  );
                if (!images.length) return false;
                event.preventDefault();
                images.forEach(async (file) => {
                  const { src } = await upload(file);
                  const { schema } = view.state;
                  const node = schema.nodes.image!.create({
                    src,
                    alt: file.name,
                  });
                  view.dispatch(view.state.tr.replaceSelectionWith(node));
                });
                return true;
              },
            },
          },
        }),
      ];
    },
  });
}
