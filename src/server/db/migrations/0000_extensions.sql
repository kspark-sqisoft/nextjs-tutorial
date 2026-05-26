-- gen_random_uuid() 를 위한 pgcrypto, 대소문자 무시 이메일을 위한 citext.
-- 이 두 확장은 모든 후속 마이그레이션이 의존하므로 가장 먼저 적용한다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
