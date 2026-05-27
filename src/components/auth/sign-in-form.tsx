"use client";
// SignInForm — shadcn 컴포넌트 적용 + i18n.
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
    <Card>
      <CardHeader>
        <CardTitle>{t("signIn")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-3">
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
