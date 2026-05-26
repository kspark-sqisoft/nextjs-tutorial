// 메일 링크에서 도착하는 페이지.
// 학습 포인트: Server Action 안의 revalidatePath 는 RSC 렌더 중에는 호출 불가.
// 그래서 페이지에서는 action 을 호출하지 않고, 같은 로직을 inline 으로 직접 수행한다.
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { consumeEmailVerification } from "@/server/auth/tokens";

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

  const consumed = await consumeEmailVerification(token);
  if (!consumed) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">이메일 인증</h1>
        <p className="text-red-600">만료되었거나 이미 사용된 링크입니다.</p>
      </main>
    );
  }

  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, consumed.userId));

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-xl font-semibold">이메일 인증</h1>
      <p className="text-green-600">
        이메일 인증이 완료되었습니다. 이제 로그인 할 수 있어요.
      </p>
      <a href="/sign-in" className="mt-4 inline-block underline">
        로그인 하러 가기
      </a>
    </main>
  );
}
