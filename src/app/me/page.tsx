// /me — 내 프로필 페이지. RSC 가 현재 user 로드, 자식이 폼/업로더로 분리.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { publicUrl } from "@/server/storage/s3";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function MePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">내 프로필</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">아바타</h2>
        <AvatarUploader
          initialUrl={me.avatarKey ? publicUrl(me.avatarKey) : null}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">기본 정보</h2>
        <ProfileForm initial={{ nickname: me.nickname, bio: me.bio }} />
      </section>

      <SignOutButton />
    </main>
  );
}
