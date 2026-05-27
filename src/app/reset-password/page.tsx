import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-md flex-col justify-center px-6 py-16">
        <Card className="rounded-none border-border/60 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
          <CardHeader>
            <CardTitle className="text-2xl tracking-tight">
              잘못된 링크입니다
            </CardTitle>
            <CardDescription>
              메일에서 받은 링크가 올바른지 다시 확인해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-md flex-col justify-center px-6 py-16">
      <ResetPasswordForm token={token} />
    </main>
  );
}
