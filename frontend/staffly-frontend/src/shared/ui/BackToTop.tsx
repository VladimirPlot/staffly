import { useEffect, useState, type RefObject } from "react";
import { useAnyModalOpen } from "./modalState";
import { ArrowUp } from "lucide-react";

export default function BackToTop({
  headerRef,
  raised = false,
}: {
  headerRef: RefObject<HTMLElement | null>;
  raised?: boolean;
}) {
  const modalOpen = useAnyModalOpen();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () => setVisible(header.getBoundingClientRect().bottom <= 0);
    update();
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(update);
      observer.observe(header);
      return () => observer.disconnect();
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [headerRef]);
  if (!visible || modalOpen) return null;
  return (
    <button
      type="button"
      title="Наверх"
      aria-label="Вернуться наверх"
      className={`border-subtle bg-surface text-default focus:ring-default fixed right-[calc(1rem+var(--staffly-safe-area-right))] z-40 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg focus-visible:ring-2 ${raised ? "bottom-[calc(6rem+var(--staffly-safe-area-bottom))]" : "bottom-[calc(1rem+var(--staffly-safe-area-bottom))]"}`}
      onClick={() => {
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
        headerRef.current?.focus({ preventScroll: true });
      }}
    >
      <ArrowUp aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
