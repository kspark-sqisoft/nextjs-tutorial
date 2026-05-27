import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-md flex-col justify-center px-6 py-16">
      <SignUpForm />
      <p className="mt-6 text-sm text-muted-foreground">
        이미 가입했나요?{" "}
        <Link href="/sign-in" className="text-foreground hover:underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
