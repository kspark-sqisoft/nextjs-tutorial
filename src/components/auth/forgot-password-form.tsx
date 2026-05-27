"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestPasswordResetAction,
  type ActionState,
} from "@/server/actions/auth";
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

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "발송 중..." : "재설정 메일 받기"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    requestPasswordResetAction,
    null,
  );
  return (
    <Card className="rounded-none border-border/60 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">
          비밀번호 찾기
        </CardTitle>
        <CardDescription>
          가입한 이메일로 재설정 링크를 보내드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">가입한 이메일</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Submit />
          {state && (
            <p className="text-sm text-muted-foreground">{state.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
