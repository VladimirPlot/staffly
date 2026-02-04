import React from "react";

type ToastProps = {
  message: string | null;
  durationMs?: number;
  onClose: () => void;
};

export default function Toast({ message, durationMs = 4000, onClose }: ToastProps) {
  React.useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onClose]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="pointer-events-auto rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
