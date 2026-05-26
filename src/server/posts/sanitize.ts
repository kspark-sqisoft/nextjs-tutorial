// Tiptap JSON → 안전한 HTML.
// 학습 포인트: 신뢰할 수 없는 사용자 입력이므로,
// 허용 마크/노드 화이트리스트로 한 번 거른 뒤 generateHTML 로 변환한다.
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";

// Tiptap 3.x 의 JSONContent 타입은 외부 export 가 패키지별로 다르다.
// 학습 단순화: 화이트리스트로 필터링한 결과만 generateHTML 에 넘기고 타입은 cast.
type TiptapDoc = Parameters<typeof generateHTML>[0];

const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "codeBlock",
  "hardBreak",
  "image",
]);

const ALLOWED_MARKS = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "link",
]);

type Node = {
  type?: string;
  content?: Node[];
  marks?: { type?: string }[];
};

function filter(node: Node): Node | null {
  if (!node.type || (node.type !== "doc" && !ALLOWED_NODES.has(node.type)))
    return null;
  const next: Node = { ...node };
  if (node.marks)
    next.marks = node.marks.filter(
      (m) => m.type && ALLOWED_MARKS.has(m.type),
    );
  if (node.content)
    next.content = node.content
      .map(filter)
      .filter((n): n is Node => n !== null);
  return next;
}

export function renderTiptapToSafeHtml(json: unknown): string {
  const cleaned = filter(json as Node) ?? { type: "doc", content: [] };
  // generateHTML 의 두 번째 인자는 schema 를 결정짓는 extension 목록.
  // 본문에서 쓰이지 않은 마크/노드는 generateHTML 단계에서 추가로 무시된다.
  return generateHTML(cleaned as TiptapDoc, [StarterKit, Image, Link]);
}
