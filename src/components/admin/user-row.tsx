"use client";
// 활성/비활성 토글 — useOptimistic 단일 boolean 패턴.
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { trpc } from "@/lib/trpc-client";

interface UserDTO {
  id: string;
  email: string;
  nickname: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  avatarUrl: string | null;
}

export function UserRow({ user }: { user: UserDTO }) {
  const router = useRouter();
  const setActive = trpc.admin.users.setActive.useMutation();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    user.isActive,
    (_s, n: boolean) => n,
  );

  function onToggle() {
    if (pending || setActive.isPending) return;
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await setActive.mutateAsync({ userId: user.id, isActive: next });
        router.refresh();
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 py-3 text-sm">
      {user.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="size-8 rounded-full object-cover"
        />
      ) : (
        <div className="size-8 rounded-full bg-zinc-200" />
      )}
      <div className="flex-1">
        <div className="font-medium">{user.nickname}</div>
        <div className="text-xs text-zinc-500">{user.email}</div>
      </div>
      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-900">
        {user.role}
      </span>
      {!user.emailVerifiedAt && (
        <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
          미인증
        </span>
      )}
      <button
        onClick={onToggle}
        disabled={pending || setActive.isPending}
        className={
          "rounded border px-3 py-1 text-xs " +
          (optimistic
            ? "bg-white dark:bg-transparent"
            : "bg-red-50 text-red-700 dark:bg-red-950")
        }
      >
        {optimistic ? "활성" : "비활성"} (토글)
      </button>
    </li>
  );
}
