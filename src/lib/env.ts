// 학습용: 부팅 시점에 환경변수를 zod 로 강제 검증한다.
// 누락/오타 시 명확한 에러를 던져, 런타임에서 undefined 가 떠다니는 일을 막는다.
import { z } from "zod";

const Env = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_PUBLIC_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),
  DEFAULT_LOCALE: z.enum(["ko", "en"]).default("ko"),
  SUPPORTED_LOCALES: z.string().default("ko,en"),
});

// process.env 는 string|undefined 라 zod 파싱이 안전하다.
export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
