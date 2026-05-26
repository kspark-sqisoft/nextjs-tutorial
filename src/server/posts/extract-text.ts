// Tiptap JSON 트리에서 텍스트 노드만 모아 한 문자열로 변환 — 검색·미리보기용.
type Node = { type?: string; text?: string; content?: Node[] };

export function extractText(json: unknown): string {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.text) out.push(n.text);
    n.content?.forEach(walk);
  };
  walk(json as Node);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
