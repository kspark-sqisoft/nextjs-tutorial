// Docker HEALTHCHECK 용 엔드포인트.
// 학습 포인트:
//  - App Router 의 Route Handler 는 파일 한 개에 HTTP 메서드 별 export.
//  - 컨테이너 헬스체크는 가벼움이 미덕 — DB 핑 같은 무거운 동작은 일부러 뺐다.
//  - wget --spider 가 200 만 확인하면 OK. 본문은 디버깅 편의용.
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    at: new Date().toISOString(),
  });
}
