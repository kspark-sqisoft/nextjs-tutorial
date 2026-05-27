"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction } from "@/server/actions/profile";
import type { ActionState } from "@/server/actions/auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "저장 중..." : "저장"}
    </Button>
  );
}

export function ProfileForm({
  initial,
}: {
  initial: { nickname: string; bio: string | null };
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateProfileAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          name="nickname"
          defaultValue={initial.nickname}
          required
          minLength={2}
          maxLength={20}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="bio">한 줄 소개</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio ?? ""}
          maxLength={200}
          rows={3}
        />
      </div>
      <div className="flex items-center gap-3">
        <Submit />
        {state && (
          <span
            className={
              state.ok
                ? "text-sm text-emerald-600"
                : "text-sm text-destructive"
            }
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
