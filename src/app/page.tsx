// 부팅 검증용 홈페이지.
// 마일스톤 5 에서 진짜 피드 페이지로 교체된다.
import { getCurrentUser } from "@/server/auth/current-user";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function HomePage() {
  const me = await getCurrentUser();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">학습용 블로그 🚀</h1>
      <p className="text-sm text-zinc-500">
        M3 인증까지 완성. 다음은 M4 (프로필 + Presigned 업로드).
      </p>
      <div className="text-sm">
        {me ? (
          <div className="flex items-center gap-3">
            <span>
              👋 <strong>{me.nickname}</strong> ({me.role})
            </span>
            <a href="/me" className="underline">
              내 프로필
            </a>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex gap-3">
            <a href="/sign-in" className="underline">
              로그인
            </a>
            <a href="/sign-up" className="underline">
              회원가입
            </a>
          </div>
        )}
      </div>
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
