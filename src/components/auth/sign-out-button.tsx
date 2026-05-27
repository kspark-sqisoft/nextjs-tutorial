// 로그아웃 form. Server Action 한 줄.
import { signOutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        로그아웃
      </Button>
    </form>
  );
}
