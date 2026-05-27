// 전역 푸터 — RSC. 미니멀 Apple 톤.
// 학습 포인트: 푸터를 항상 화면 하단으로 밀려면 body 가 flex-col + main 이 flex-1.
import Link from "next/link";

const techStack = [
  "Next.js 15",
  "React 19",
  "TypeScript",
  "TailwindCSS v4",
  "Drizzle",
  "tRPC v11",
  "TanStack Query",
  "PostgreSQL",
  "MinIO",
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-background/40">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* 상단 — 로고/카피 + 링크 그룹. */}
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <span
                aria-hidden
                className="inline-block size-2 rounded-full bg-foreground"
              />
              <span>학습용 블로그</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Next.js 15 와 React 19 의 최신 패턴을 실제로 만들며 익히기
              위한 학습 프로젝트입니다.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              둘러보기
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-muted-foreground hover:text-foreground"
                >
                  홈
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="text-muted-foreground hover:text-foreground"
                >
                  검색
                </Link>
              </li>
              <li>
                <Link
                  href="/categories/general"
                  className="text-muted-foreground hover:text-foreground"
                >
                  카테고리
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              문서
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://nextjs.org/docs"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Next.js Docs ↗
                </a>
              </li>
              <li>
                <a
                  href="https://react.dev"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                >
                  React Docs ↗
                </a>
              </li>
              <li>
                <a
                  href="https://orm.drizzle.team"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Drizzle ORM ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 기술 스택 chip 들. */}
        <ul className="mt-10 flex flex-wrap gap-2">
          {techStack.map((s) => (
            <li
              key={s}
              className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-[11px] tracking-wide text-muted-foreground"
            >
              {s}
            </li>
          ))}
        </ul>

        {/* 하단 카피라이트. */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/40 pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} 학습용 블로그</p>
          <p className="tabular-nums">
            Built with Next.js 15 · React 19 · Geist
          </p>
        </div>
      </div>
    </footer>
  );
}
