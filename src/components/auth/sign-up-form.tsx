"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { signUpAction, type ActionState } from "@/server/actions/auth";
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
      {pending ? "처리 중..." : label}
    </Button>
  );
}

export function SignUpForm() {
  const t = useTranslations("nav");
  const [state, action] = useActionState<ActionState, FormData>(
    signUpAction,
    null,
  );
  return (
    <Card className="rounded-none border-border/60 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">
          {t("signUp")}
        </CardTitle>
        <CardDescription>
          몇 가지 정보만 입력하면 바로 시작할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nickname">닉네임</Label>
            <Input
              id="nickname"
              name="nickname"
              required
              minLength={2}
              maxLength={20}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">비밀번호 (8자 이상)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
            />
          </div>
          <Submit label={t("signUp")} />
          {state && (
            <p
              className={
                state.ok
                  ? "text-sm text-emerald-600"
                  : "text-sm text-destructive"
              }
            >
              {state.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
