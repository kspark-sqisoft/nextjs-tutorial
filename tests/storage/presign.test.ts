import { describe, expect, it } from "vitest";
import { keyFor, requestUpload } from "@/server/storage/presign";

describe("presign", () => {
  it("AVATAR 키 prefix 는 'avatars/'", () => {
    const k = keyFor("AVATAR", "image/png");
    expect(k.startsWith("avatars/")).toBe(true);
    expect(k.endsWith(".png")).toBe(true);
  });

  it("화이트리스트에 없는 MIME 은 throw", async () => {
    await expect(
      requestUpload({
        kind: "AVATAR",
        mime: "application/x-msdownload",
        sizeBytes: 1000,
      }),
    ).rejects.toThrow(/허용되지 않/);
  });

  it("사이즈 한도 초과 시 throw", async () => {
    await expect(
      requestUpload({
        kind: "AVATAR",
        mime: "image/png",
        sizeBytes: 10 * 1024 * 1024,
      }),
    ).rejects.toThrow(/MB 이하/);
  });

  it("정상 요청은 uploadUrl 과 objectKey 반환", async () => {
    const r = await requestUpload({
      kind: "AVATAR",
      mime: "image/png",
      sizeBytes: 1024,
    });
    expect(r.uploadUrl).toMatch(/^http/);
    expect(r.objectKey.startsWith("avatars/")).toBe(true);
    expect(r.headers["Content-Type"]).toBe("image/png");
  });
});
