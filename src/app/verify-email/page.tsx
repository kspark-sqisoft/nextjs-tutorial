// 메일 링크에서 도착하는 페이지. URL 쿼리의 token 으로 즉시 verifyEmailAction 호출.
import { verifyEmailAction } from "@/server/actions/auth";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="mx-auto max-w-md p-8">
        <p className="text-red-600">잘못된 링크입니다.</p>
      </main>
    );
  }
  const fd = new FormData();
  fd.set("token", token);
  const result = await verifyEmailAction(null, fd);
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-xl font-semibold">이메일 인증</h1>
      <p
        className={
          result && result.ok ? "text-green-600" : "text-red-600"
        }
      >
        {result?.message ?? ""}
      </p>
      {result?.ok && (
        <a href="/sign-in" className="mt-4 inline-block underline">
          로그인 하러 가기
        </a>
      )}
    </main>
  );
}
