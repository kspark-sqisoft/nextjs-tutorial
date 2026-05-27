// 학습용: React Email 컴포넌트로 메일 본문 작성.
// 일반 HTML 보다 클라이언트 호환성을 위한 인라인 스타일/테이블 패턴이 강제된다.
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

export interface VerifyEmailProps {
  nickname: string;
  verifyUrl: string;
}

export default function VerifyEmail({ nickname, verifyUrl }: VerifyEmailProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>BLOG 이메일 인증</Preview>
      <Body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <Container>
          <Heading>안녕하세요, {nickname}님 👋</Heading>
          <Text>
            아래 버튼을 눌러 이메일 인증을 완료해주세요. 링크는 24시간 동안
            유효합니다.
          </Text>
          <Button
            href={verifyUrl}
            style={{
              background: "#111",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: 6,
            }}
          >
            이메일 인증하기
          </Button>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 24 }}>
            직접 가입하지 않으셨다면 이 메일은 무시하셔도 됩니다.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
