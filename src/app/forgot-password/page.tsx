import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-md flex-col justify-center px-6 py-16">
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/sign-in" className="text-foreground hover:underline">
          ← 로그인으로
        </Link>
      </p>
    </main>
  );
}
