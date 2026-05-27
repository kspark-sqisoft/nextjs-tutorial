"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  resetPasswordAction,
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
      {pending ? "변경 중..." : "비밀번호 변경"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    null,
  );
  return (
    <Card className="rounded-none border-border/60 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">
          비밀번호 재설정
        </CardTitle>
        <CardDescription>
          새 비밀번호를 입력하세요. (최소 8자)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <div className="grid gap-1.5">
            <Label htmlFor="password">새 비밀번호</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
            />
          </div>
          <Submit />
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
