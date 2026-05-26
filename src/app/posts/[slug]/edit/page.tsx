// 글 수정 페이지 — 작성자/ADMIN 만.
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { createCaller } from "@/server/trpc/caller";
import { PostForm } from "@/components/post/post-form";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  const { slug } = await params;
  const caller = await createCaller();
  let post;
  try {
    post = await caller.post.bySlug({ slug });
  } catch {
    return notFound();
  }
  if (post.authorId !== me.id && me.role !== "ADMIN") return notFound();
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">글 수정</h1>
      <PostForm
        mode="edit"
        initial={{
          id: post.id,
          title: post.title,
          contentJson: post.contentJson,
          categorySlug: post.categorySlug ?? null,
          tagSlugs: post.tags.map((t) => t.slug),
          isPublished: true,
        }}
      />
    </main>
  );
}
