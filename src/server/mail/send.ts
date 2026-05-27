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
  // M9 에서 [locale] segment 가 도입되면 NextIntl Link/url 헬퍼로 교체.
  // 현재는 평탄 경로 /verify-email 을 직접 사용.
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${encodeURIComponent(p.token)}`;
  const html = await render(
    VerifyEmail({ nickname: p.nickname, verifyUrl }),
  );
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: p.to,
    subject: "[BLOG] 이메일 인증",
    html,
  });
}

export async function sendResetPasswordEmail(p: {
  to: string;
  nickname: string;
  token: string;
}) {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(p.token)}`;
  const html = await render(
    ResetPassword({ nickname: p.nickname, resetUrl }),
  );
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: p.to,
    subject: "[BLOG] 비밀번호 재설정",
    html,
  });
}
