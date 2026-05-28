"use client";
// 브라우저 뒤로가기/앞으로가기에 View Transition 을 입힌다.
// 학습 포인트:
//  - <PostLink> 의 onClick 은 "앞으로 이동(링크 클릭)" 케이스만 잡는다.
//    브라우저 뒤로가기 버튼 / 모바일 swipe 제스처는 클릭이 아니라 popstate 이벤트를 발생시킨다.
//  - popstate 는 브라우저가 URL 을 바꾼 직후 동기로 발사된다. 이 시점엔 아직
//    Next 의 라우터가 새 화면을 commit 하기 전이라 startViewTransition 으로
//    "현재 DOM = before snapshot" 을 안전하게 캡처할 수 있다.
//  - startViewTransition 의 callback 은 두 frame 동안 await 한다. 그 사이에
//    Next 라우터가 RSC payload(이미 캐시됨) 로 새 DOM 을 commit 하므로,
//    그 결과가 "after snapshot" 으로 잡혀 morph 가 자연스럽게 일어난다.
//  - 호환성: View Transitions API 미지원 브라우저(예: 일부 Firefox/구버전 iOS)에서는
//    조용히 no-op 으로 fallback. 추가 폴리필이나 분기 코드는 필요 없다.
import { useEffect } from "react";

// document.startViewTransition 의 (현재) 표준 시그니처. lib.dom 에 아직 안 들어와 직접 선언.
type StartViewTransition = (
  cb: () => void | Promise<void>,
) => { finished: Promise<void>; ready: Promise<void> } | unknown;

export function ViewTransitionsListener() {
  useEffect(() => {
    const doc = document as Document & {
      startViewTransition?: StartViewTransition;
    };
    // API 미지원 브라우저면 아무 것도 안 한다 — 자연스러운 fallback.
    if (typeof doc.startViewTransition !== "function") return;

    function onPopState() {
      // callback 안에서 promise 를 반환하면 startViewTransition 은 그 promise 가
      // 해소될 때까지 "after snapshot" 캡처를 미룬다. 2 RAF 면 보통 React 의
      // 동일 cycle commit 까지 끝나 새 DOM 이 자리잡아 있다.
      doc.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          }),
      );
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
