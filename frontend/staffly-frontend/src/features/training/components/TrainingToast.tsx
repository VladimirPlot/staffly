import React from "react";

type TrainingToastProps = {
  message: string | null;
  onClose: () => void;
  durationMs?: number;
};

export default function TrainingToast({ message, onClose, durationMs = 3500 }: TrainingToastProps) {
  React.useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onClose, durationMs]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="pointer-events-auto rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">{message}</div>
    </div>
  );
}
