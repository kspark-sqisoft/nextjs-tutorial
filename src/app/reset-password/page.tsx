import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <p className="text-red-600">잘못된 링크입니다.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">비밀번호 재설정</h1>
      <ResetPasswordForm token={token} />
    </main>
  );
}
