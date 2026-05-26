// Mailpit 은 인증 없는 SMTP 1025. 운영에서는 SES/SendGrid 등으로 교체.
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});
