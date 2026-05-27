"use client";
// SignInForm — shadcn 컴포넌트 + i18n + 각진 카드 톤.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { signInAction, type ActionState } from "@/server/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "..." : label}
    </Button>
  );
}

export function SignInForm() {
  const t = useTranslations("nav");
  const [state, action] = useActionState<ActionState, FormData>(
    signInAction,
    null,
  );
  return (
    <Card className="rounded-none border-border/60 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">
          {t("signIn")}
        </CardTitle>
        <CardDescription>
          이메일과 비밀번호로 로그인하세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Submit label={t("signIn")} />
          {state && !state.ok && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
