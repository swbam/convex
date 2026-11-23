import { useEffect } from "react";

/** Safari can ignore viewport scale limits, so also cancel its page pinch gestures. */
export function MobileViewport() {
  useEffect(() => {
    const touchDevice = window.matchMedia("(any-pointer: coarse)");
    const preventPageZoom = (event: Event) => {
      if (touchDevice.matches && event.cancelable) event.preventDefault();
    };
    const options = { passive: false };
    document.addEventListener("gesturestart", preventPageZoom, options);
    document.addEventListener("gesturechange", preventPageZoom, options);
    return () => {
      document.removeEventListener("gesturestart", preventPageZoom);
      document.removeEventListener("gesturechange", preventPageZoom);
    };
  }, []);
  return null;
}
