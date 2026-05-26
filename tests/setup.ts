// Vitest 부팅 시 .env 를 로드해 process.env 를 채운다.
// 호스트에서 테스트를 돌리는 경우 DATABASE_URL 의 host 가 'postgres'(컨테이너명) 이면 안 되므로
// TEST_DATABASE_URL 이 있으면 우선 사용한다.
import { config } from "dotenv";
config({ path: ".env" });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
