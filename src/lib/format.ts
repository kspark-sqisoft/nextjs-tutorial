// 서버/클라이언트 hydration 일관성을 위해 timezone 을 명시적으로 고정한다.
// (서버 컨테이너 TZ 와 사용자 브라우저 TZ 가 다르면 toLocaleString 결과가 어긋나
//  React hydration mismatch 가 발생한다.)
const KO_DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function formatKoDateTime(value: Date | string | number): string {
  return new Date(value).toLocaleString("ko-KR", KO_DATE_OPTS);
}
