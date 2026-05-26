// React Email 컴포넌트를 HTML 문자열로 렌더하고 nodemailer 로 발송.
// 학습 포인트: render() 는 비동기 — 내부적으로 React renderToStaticMarkup 사용.
import { render } from "@react-email/components";
import VerifyEmail from "./templates/verify-email";
import ResetPassword from "./templates/reset-password";
import { transporter } from "./transport";
import { env } from "@/lib/env";

export async function sendVerifyEmail(p: {
  to: string;
  nickname: string;
  token: string;
}) {
  // i18n 도입(M9) 전이라 ko 경로 고정. 나중에 NextIntl Link 의 url 헬퍼로 교체 권장.
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/ko/verify-email?token=${encodeURIComponent(p.token)}`;
  const html = await render(
    VerifyEmail({ nickname: p.nickname, verifyUrl }),
  );
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: p.to,
    subject: "[학습용 블로그] 이메일 인증",
    html,
  });
}

export async function sendResetPasswordEmail(p: {
  to: string;
  nickname: string;
  token: string;
}) {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/ko/reset-password?token=${encodeURIComponent(p.token)}`;
  const html = await render(
    ResetPassword({ nickname: p.nickname, resetUrl }),
  );
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: p.to,
    subject: "[학습용 블로그] 비밀번호 재설정",
    html,
  });
}
