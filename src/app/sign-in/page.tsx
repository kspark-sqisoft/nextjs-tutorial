import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">로그인</h1>
      <SignInForm />
      <div className="mt-4 flex justify-between text-xs text-zinc-500">
        <a href="/sign-up" className="underline">
          회원가입
        </a>
        <a href="/forgot-password" className="underline">
          비밀번호 찾기
        </a>
      </div>
    </main>
  );
}
