"use client";
// 토큰은 메일 링크의 쿼리스트링으로 전달 → 페이지에서 prop 으로 받아 hidden input 으로 액션에 전달.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  resetPasswordAction,
  type ActionState,
} from "@/server/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "변경 중..." : "비밀번호 변경"}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="새 비밀번호 (8자 이상)"
        className="rounded border px-3 py-2"
      />
      <SubmitButton />
      {state && (
        <p
          className={
            state.ok ? "text-sm text-green-600" : "text-sm text-red-600"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
