// argon2id — OWASP 권장 비밀번호 해시. bcrypt 보다 메모리/시간 비용 조절이 명확.
// 학습 포인트: salt 는 라이브러리가 자동 생성·인코딩한다. 해시 문자열 안에 salt+params 가 다 들어 있어 단일 컬럼 저장.
import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 의 Algorithm enum 은 const enum 이라 isolatedModules 에서 import 불가.
// 0=Argon2d / 1=Argon2i / 2=Argon2id — 우리는 2(Argon2id) 사용.
const COMMON_OPTS = {
  algorithm: 2 as const,
  // 학습용 합리적 default. 운영은 부하 측정 후 상향.
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, COMMON_OPTS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    // 해시 문자열이 손상된 경우에도 false 로 안전 실패.
    return false;
  }
}
