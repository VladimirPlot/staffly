import React from "react";

type ScrollLockSnapshot = {
  bodyOverflow: string;
  bodyTouchAction: string;
  bodyOverscrollBehavior: string;
  htmlOverflow: string;
  htmlTouchAction: string;
  htmlOverscrollBehavior: string;
};

export function useBodyScrollLock(isLocked: boolean) {
  React.useEffect(() => {
    if (!isLocked) return;

    const body = document.body;
    const html = document.documentElement;
    const previous: ScrollLockSnapshot = {
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlTouchAction: html.style.touchAction,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
    };

    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.overscrollBehavior = "none";
    html.style.overflow = "hidden";
    html.style.touchAction = "none";
    html.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.touchAction = previous.bodyTouchAction;
      body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
      html.style.overflow = previous.htmlOverflow;
      html.style.touchAction = previous.htmlTouchAction;
      html.style.overscrollBehavior = previous.htmlOverscrollBehavior;
    };
  }, [isLocked]);
}
