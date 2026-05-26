// 비밀번호 재설정 메일 템플릿.
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

export interface ResetPasswordProps {
  nickname: string;
  resetUrl: string;
}

export default function ResetPassword({
  nickname,
  resetUrl,
}: ResetPasswordProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>비밀번호 재설정</Preview>
      <Body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <Container>
          <Heading>비밀번호 재설정</Heading>
          <Text>
            {nickname}님, 아래 버튼을 눌러 새 비밀번호를 설정하세요. 링크는
            1시간 동안 유효합니다.
          </Text>
          <Button
            href={resetUrl}
            style={{
              background: "#111",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: 6,
            }}
          >
            비밀번호 재설정
          </Button>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 24 }}>
            요청하지 않았다면 이 메일을 무시하셔도 됩니다.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
