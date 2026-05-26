"use client";
// 닉네임/소개 수정 폼 — Server Action(updateProfileAction) + useActionState.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction } from "@/server/actions/profile";
import type { ActionState } from "@/server/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "저장 중..." : "저장"}
    </button>
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
      <label className="text-sm">
        닉네임
        <input
          name="nickname"
          defaultValue={initial.nickname}
          required
          minLength={2}
          maxLength={20}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="text-sm">
        한 줄 소개
        <textarea
          name="bio"
          defaultValue={initial.bio ?? ""}
          maxLength={200}
          className="mt-1 w-full rounded border px-3 py-2"
          rows={3}
        />
      </label>
      <div className="flex items-center gap-3">
        <Submit />
        {state && (
          <span
            className={
              state.ok ? "text-sm text-green-600" : "text-sm text-red-600"
            }
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
