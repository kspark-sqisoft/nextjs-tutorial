"use server";
// 학습 포인트:
//  - 폼 제출은 Server Actions 로 (`useActionState` 와 결합).
//  - mutation 후 영향 받는 경로는 revalidatePath.
//  - 에러는 throw 가 아니라 { ok:false, message } 로 반환해 UI 가 그대로 표시하게 한다.
//  - 성공 후 페이지 이동이 필요한 경우만 redirect.
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, revokeSession } from "@/server/auth/session";
import {
  setAuthCookies,
  clearAuthCookies,
  readRefreshCookie,
} from "@/server/auth/cookies";
import {
  issueEmailVerification,
  consumeEmailVerification,
  issuePasswordReset,
  consumePasswordReset,
} from "@/server/auth/tokens";
import { sendVerifyEmail, sendResetPasswordEmail } from "@/server/mail/send";
import { verifyRefresh } from "@/server/auth/jwt";

export type ActionState =
  | { ok: false; message: string }
  | { ok: true; message?: string }
  | null;

const SignUpInput = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(8, "비밀번호는 8자 이상").max(72),
  nickname: z.string().min(2).max(20),
});

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = SignUpInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]!.message };
  }
  const { email, password, nickname } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length)
    return { ok: false, message: "이미 가입된 이메일입니다." };

  const passwordHash = await hashPassword(password);
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash, nickname })
    .returning({ id: users.id, nickname: users.nickname });

  const token = await issueEmailVerification(u!.id);
  // 메일 발송 실패는 회원가입 자체를 막지 않음 — 재발송 흐름은 향후 추가.
  try {
    await sendVerifyEmail({ to: email, nickname: u!.nickname, token });
  } catch (err) {
    console.error("[mail] verify send failed", err);
  }
  return { ok: true, message: "메일함을 확인해 이메일 인증을 완료해주세요." };
}

const SignInInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = SignInInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { ok: false, message: "이메일/비밀번호를 확인해주세요." };
  const { email, password } = parsed.data;

  const [u] = await db
    .select({
      id: users.id,
      role: users.role,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u)
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  if (!u.isActive) return { ok: false, message: "비활성화된 계정입니다." };
  const ok = await verifyPassword(u.passwordHash, password);
  if (!ok)
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  if (!u.emailVerifiedAt)
    return { ok: false, message: "이메일 인증이 필요합니다." };

  const { access, refresh } = await createSession({
    userId: u.id,
    role: u.role,
  });
  await setAuthCookies({ access, refresh });
  // 학습 포인트: redirect 는 throw 로 작동 → 호출 후 코드가 실행되지 않음.
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const refresh = await readRefreshCookie();
  if (refresh) {
    try {
      const p = await verifyRefresh(refresh);
      await revokeSession(p.jti);
    } catch {
      // 위조/만료된 refresh 라면 그냥 쿠키만 지운다.
    }
  }
  await clearAuthCookies();
  redirect("/sign-in");
}

const VerifyEmailInput = z.object({ token: z.string().min(10) });

export async function verifyEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = VerifyEmailInput.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { ok: false, message: "잘못된 인증 링크입니다." };
  const result = await consumeEmailVerification(parsed.data.token);
  if (!result)
    return { ok: false, message: "만료되었거나 이미 사용된 링크입니다." };
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, result.userId));
  // revalidatePath 제거: RSC 에서 직접 호출되는 경우(verify-email 페이지) Next.js 가
  // 렌더 중 revalidatePath 를 금지한다. 사용자는 어차피 로그인 시 새로 fetch 되므로 무해.
  return {
    ok: true,
    message: "이메일 인증이 완료되었습니다. 이제 로그인 할 수 있어요.",
  };
}

const RequestResetInput = z.object({ email: z.string().email() });

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = RequestResetInput.safeParse({
    email: formData.get("email"),
  });
  // 이메일 존재 여부를 응답으로 노출하지 않는다(계정 열거 방지).
  if (!parsed.success)
    return { ok: true, message: "메일을 보냈습니다(존재한다면)." };
  const [u] = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (u) {
    const token = await issuePasswordReset(u.id);
    try {
      await sendResetPasswordEmail({
        to: parsed.data.email,
        nickname: u.nickname,
        token,
      });
    } catch (err) {
      console.error("[mail] reset send failed", err);
    }
  }
  return { ok: true, message: "메일을 보냈습니다(존재한다면)." };
}

const ResetPasswordInput = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(72),
});

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ResetPasswordInput.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "입력을 확인해주세요." };
  const consumed = await consumePasswordReset(parsed.data.token);
  if (!consumed)
    return { ok: false, message: "만료되었거나 이미 사용된 링크입니다." };
  const passwordHash = await hashPassword(parsed.data.password);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, consumed.userId));
  return {
    ok: true,
    message: "비밀번호가 변경되었습니다. 다시 로그인 해주세요.",
  };
}
