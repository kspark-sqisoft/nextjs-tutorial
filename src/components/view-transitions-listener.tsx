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
      // 이번 popstate 전환은 "애니메이션 0초(즉시)" 로 처리한다.
      // 이유: 리스트에서 한참 스크롤한 뒤 글로 들어갔다 뒤로 오면, 카드와 상세 hero 가
      //   공유하는 view-transition-name(post-<id>) 때문에 브라우저가 그 요소를 화면을
      //   가로질러 morph 시켜 "스크롤되는 것처럼" 보인다. data-popstate-vt 플래그로
      //   globals.css 에서 해당 전환의 애니메이션 시간만 0 으로 눌러 즉시 보이게 한다.
      //   스냅샷 자체는 유지되므로 DOM 교체 순간의 깜빡임 방지 효과는 그대로다.
      //   (앞으로가기 = <PostLink> 클릭 morph 는 이 플래그가 없어 영향받지 않는다.)
      const root = doc.documentElement;
      root.dataset.popstateVt = "1";
      // callback 안에서 promise 를 반환하면 startViewTransition 은 그 promise 가
      // 해소될 때까지 "after snapshot" 캡처를 미룬다. 2 RAF 면 보통 React 의
      // 동일 cycle commit 까지 끝나 새 DOM 이 자리잡아 있다.
      const transition = doc.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              resolve();
            };
            // 정상 경로: 2 RAF 뒤 commit 완료 시점에 resolve.
            requestAnimationFrame(() => requestAnimationFrame(finish));
            // 안전망: 백그라운드 탭이면 RAF 가 멈추지만 setTimeout 은 (throttle 돼도)
            // 결국 발사된다. 브라우저 자체 타임아웃(~4초)보다 먼저 끊어 TimeoutError 를
            // 원천 차단한다. 이때 캡처되는 after snapshot 이 살짝 일러도 morph 만 생략될 뿐.
            setTimeout(finish, 250);
          }),
      ) as
        | {
            finished?: Promise<void>;
            ready?: Promise<void>;
            updateCallbackDone?: Promise<void>;
          }
        | undefined;
      // 전환이 끝나면(성공/실패 무관) 플래그를 제거해 다음 전환에 영향이 없게 한다.
      const cleanup = () => {
        delete root.dataset.popstateVt;
      };
      // 그래도 타임아웃이 나면 finished/ready/updateCallbackDone 가 동시에 reject 된다.
      // 셋 다 잡지 않으면 안 잡힌 쪽이 unhandled rejection 으로 dev 오버레이에 뜬다.
      // 애니메이션만 생략되는 양성 에러이므로 모두 조용히 무시한다.
      const noop = () => {};
      transition?.ready?.catch(noop);
      transition?.updateCallbackDone?.catch(noop);
      if (transition?.finished) {
        // finished 의 resolve/reject 양쪽에서 플래그 정리.
        transition.finished.then(cleanup, cleanup);
      } else {
        cleanup();
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
