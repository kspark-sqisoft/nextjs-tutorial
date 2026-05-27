import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-md flex-col justify-center px-6 py-16">
      <SignInForm />
      <div className="mt-6 flex justify-between text-sm text-muted-foreground">
        <Link href="/sign-up" className="hover:text-foreground">
          회원가입
        </Link>
        <Link href="/forgot-password" className="hover:text-foreground">
          비밀번호 찾기
        </Link>
      </div>
    </main>
  );
}
