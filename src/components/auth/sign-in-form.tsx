"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type ActionState } from "@/server/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "로그인 중..." : "로그인"}
    </button>
  );
}

export function SignInForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    signInAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        placeholder="이메일"
        className="rounded border px-3 py-2"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="비밀번호"
        className="rounded border px-3 py-2"
      />
      <SubmitButton />
      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
