"use client";
// React 19 의 useActionState + useFormStatus 패턴 데모.
// - useActionState: 액션 결과를 state 로 받아 UI 에 표시.
// - useFormStatus: form 안의 child component 에서 pending 여부 구독.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction, type ActionState } from "@/server/actions/auth";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "처리 중..." : label}
    </button>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    signUpAction,
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
        name="nickname"
        required
        minLength={2}
        maxLength={20}
        placeholder="닉네임"
        className="rounded border px-3 py-2"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="비밀번호 (8자 이상)"
        className="rounded border px-3 py-2"
      />
      <SubmitButton label="회원가입" />
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
