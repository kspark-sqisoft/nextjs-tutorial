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
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="email">가입한 이메일</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Submit />
      {state && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
    </form>
  );
}
