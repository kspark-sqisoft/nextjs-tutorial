"use client";
// View Transitions API — 카드 → 상세 페이지 전환에 부드러운 모핑.
// 학습 포인트:
//  - document.startViewTransition 이 두 페이지 사이의 같은 viewTransitionName
//    가진 요소를 자동으로 morph.
//  - 미지원 브라우저(Firefox, Safari 일부)에서는 자연스럽게 일반 navigation 으로 fallback.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

type StartViewTransition = (cb: () => void) => unknown;

export function PostLink({
  href,
  viewTransitionName,
  children,
  className,
}: {
  href: string;
  viewTransitionName: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function onClick(e: React.MouseEvent) {
    // 미지원 브라우저 — Link 의 기본 navigation 그대로.
    const doc = document as Document & {
      startViewTransition?: StartViewTransition;
    };
    if (!doc.startViewTransition) return;
    e.preventDefault();
    doc.startViewTransition(() => {
      startTransition(() => router.push(href));
    });
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={className}
      style={{ viewTransitionName }}
    >
      {children}
    </Link>
  );
}
