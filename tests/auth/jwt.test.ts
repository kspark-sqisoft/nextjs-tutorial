import { describe, expect, it } from "vitest";
import {
  signAccess,
  verifyAccess,
  signRefresh,
  verifyRefresh,
} from "@/server/auth/jwt";

describe("jwt", () => {
  it("access 발급/검증 라운드트립", async () => {
    const t = await signAccess({ sub: "user-1", role: "USER" });
    const p = await verifyAccess(t);
    expect(p.sub).toBe("user-1");
    expect(p.role).toBe("USER");
  });

  it("refresh 는 jti 가 필수", async () => {
    const t = await signRefresh({ sub: "u", jti: "sess-1" });
    const p = await verifyRefresh(t);
    expect(p.jti).toBe("sess-1");
  });

  it("위조 토큰은 throw", async () => {
    await expect(verifyAccess("not.a.jwt")).rejects.toThrow();
  });
});
