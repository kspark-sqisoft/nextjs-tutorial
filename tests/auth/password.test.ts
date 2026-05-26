import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("argon2 password", () => {
  it("hash → verify 가 일치", async () => {
    const h = await hashPassword("hunter2");
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(h, "hunter2")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
  });

  it("같은 비밀번호도 매 hash 가 다르다 (random salt)", async () => {
    const a = await hashPassword("samepw");
    const b = await hashPassword("samepw");
    expect(a).not.toBe(b);
  });
});
