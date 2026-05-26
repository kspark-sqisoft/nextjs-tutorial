import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">회원가입</h1>
      <SignUpForm />
      <p className="mt-4 text-xs text-zinc-500">
        이미 가입했나요?{" "}
        <a href="/sign-in" className="underline">
          로그인
        </a>
      </p>
    </main>
  );
}
