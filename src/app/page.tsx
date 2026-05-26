// 부팅 검증용 홈페이지.
// 마일스톤 5 에서 진짜 피드 페이지로 교체된다.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">학습용 블로그 🚀</h1>
      <p className="text-sm text-zinc-500">
        부트스트랩이 정상 동작 중입니다. 다음 마일스톤은 DB 스키마(M2)입니다.
      </p>
      <ul className="text-xs text-zinc-400 list-disc">
        <li>
          tRPC ping:{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            GET /api/trpc/health.ping
          </code>
        </li>
        <li>
          Mailpit UI:{" "}
          <a className="underline" href="http://localhost:8025" target="_blank">
            http://localhost:8025
          </a>
        </li>
        <li>
          MinIO Console:{" "}
          <a className="underline" href="http://localhost:9001" target="_blank">
            http://localhost:9001
          </a>
        </li>
      </ul>
    </main>
  );
}
