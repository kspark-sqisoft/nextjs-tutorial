// SEED_ADMIN_* 환경변수가 모두 있고 해당 이메일이 없을 때만 ADMIN 1명 생성.
// 학습 차원에서 비밀번호 해시는 argon2 wrapper 그대로 사용.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nickname = process.env.SEED_ADMIN_NICKNAME ?? "admin";
  if (!email || !password) {
    console.log("ℹ️  SEED_ADMIN_* 가 없어 ADMIN 시드를 건너뜁니다.");
    process.exit(0);
  }
  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    if (existing.role !== "ADMIN") {
      // 이메일은 있지만 일반 USER → ADMIN 으로 승격.
      await db
        .update(users)
        .set({ role: "ADMIN", updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      console.log(`⬆️  ${email} 를 ADMIN 으로 승격했습니다.`);
    } else {
      console.log(`ℹ️  ADMIN ${email} 이미 존재 — 스킵.`);
    }
    process.exit(0);
  }
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    email,
    passwordHash,
    nickname,
    role: "ADMIN",
    emailVerifiedAt: new Date(), // 시드 ADMIN 은 인증 메일 생략.
  });
  console.log(`✅ ADMIN ${email} 생성 완료`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
