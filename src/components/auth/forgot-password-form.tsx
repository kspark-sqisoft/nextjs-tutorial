"use client";
// 이메일 존재 여부를 응답으로 노출하지 않으므로(action 측 정책),
// 사용자에겐 항상 "메일 보냈음(존재한다면)" 같은 메시지가 노출된다.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestPasswordResetAction,
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
      {pending ? "발송 중..." : "재설정 메일 받기"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    requestPasswordResetAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        placeholder="가입한 이메일"
        className="rounded border px-3 py-2"
      />
      <SubmitButton />
      {state && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {state.message}
        </p>
      )}
    </form>
  );
}
