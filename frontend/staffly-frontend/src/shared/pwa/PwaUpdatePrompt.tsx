import React from "react";
import Button from "../ui/Button";

const SNOOZE_KEY = "pwa:update:snoozeUntil";
const PENDING_KEY = "pwa:update:pending";
const DEFAULT_SNOOZE_MINUTES = 60; // “боевое” значение: 60 минут

function nowMs() {
  return Date.now();
}

function readSnoozeUntil(): number {
  const raw = localStorage.getItem(SNOOZE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setSnoozeMinutes(minutes: number) {
  const until = nowMs() + minutes * 60_000;
  localStorage.setItem(SNOOZE_KEY, String(until));
}

function setPending(v: boolean) {
  if (v) localStorage.setItem(PENDING_KEY, "1");
  else localStorage.removeItem(PENDING_KEY);
}

function isPending(): boolean {
  return localStorage.getItem(PENDING_KEY) === "1";
}

export default function PwaUpdatePrompt() {
  const [open, setOpen] = React.useState(false);

  // Таймер для “показать позже”
  const timerRef = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleShowAt = React.useCallback(
    (ts: number) => {
      clearTimer();
      const delay = Math.max(0, ts - nowMs());
      timerRef.current = window.setTimeout(() => {
        if (isPending()) setOpen(true);
      }, delay);
    },
    [clearTimer],
  );

  React.useEffect(() => {
    const tryOpenOrSnooze = () => {
      setPending(true);

      const snoozeUntil = readSnoozeUntil();
      if (snoozeUntil > nowMs()) {
        // Пользователь уже нажимал “Позже” — не бесим, но НЕ забываем
        scheduleShowAt(snoozeUntil);
        return;
      }

      setOpen(true);
    };

    const onNeedRefresh = () => {
      tryOpenOrSnooze();
    };

    window.addEventListener("pwa:need-refresh", onNeedRefresh);

    // Если обновление уже было “pending” с прошлого запуска — покажем снова (если snooze истёк)
    if (isPending()) {
      const snoozeUntil = readSnoozeUntil();
      if (snoozeUntil > nowMs()) scheduleShowAt(snoozeUntil);
      else setOpen(true);
    }

    // Если пользователь вернулся в приложение — можно снова проверить показ (не навязчиво)
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!isPending()) return;
      const snoozeUntil = readSnoozeUntil();
      if (snoozeUntil <= nowMs()) setOpen(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("pwa:need-refresh", onNeedRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimer();
    };
  }, [clearTimer, scheduleShowAt]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
        <div className="text-sm font-medium text-zinc-900">Доступно обновление</div>
        <div className="mt-1 text-sm text-zinc-600">
          Нажмите «Обновить», чтобы перейти на новую версию.
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            onClick={() => {
              // сбрасываем pending, чтобы баннер не появлялся снова
              setPending(false);

              const fn = (window as any).__PWA_UPDATE__ as undefined | ((reload?: boolean) => void);
              // reload=true — стандартная практика для prompt: активируем новый SW и перезагружаемся
              fn?.(true);
            }}
          >
            Обновить
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setSnoozeMinutes(DEFAULT_SNOOZE_MINUTES);
              setOpen(false);
              // pending оставляем = true, чтобы не забыть обновление
            }}
          >
            Позже
          </Button>
        </div>
      </div>
    </div>
  );
}
