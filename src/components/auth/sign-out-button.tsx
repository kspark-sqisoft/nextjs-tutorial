// 로그아웃 form. Server Action 한 줄짜리. 일반 button 이지만 form action 이 호출되어
// 서버에서 세션 revoke + 쿠키 삭제 후 /sign-in 으로 redirect.
import { signOutAction } from "@/server/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="text-sm text-zinc-500 underline">
        로그아웃
      </button>
    </form>
  );
}
