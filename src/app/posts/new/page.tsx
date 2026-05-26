// 새 글 작성 페이지. 로그인 필수.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { PostForm } from "@/components/post/post-form";

export default async function NewPostPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">새 글 작성</h1>
      <PostForm mode="create" />
    </main>
  );
}
