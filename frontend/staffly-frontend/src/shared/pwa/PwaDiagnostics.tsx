import React from "react";
import Button from "../ui/Button";
import { checkForPwaUpdate, getUpdateState, subscribeUpdate } from "./registerPwa";

const labels = {
  idle: "Проверка завершена",
  checking: "Проверяем обновления…",
  downloading: "Загружаем новую версию…",
  ready: "Обновление готово",
  applying: "Применяем обновление…",
  error: "Не удалось завершить проверку",
};

export default function PwaDiagnostics() {
  const state = React.useSyncExternalStore(subscribeUpdate, getUpdateState);
  return (
    <div className="mt-6 border-t border-[var(--staffly-border)] pt-4">
      <h3 className="font-medium">Обновление приложения</h3>
      <p className="text-muted mt-1 text-sm">{labels[state.status]}</p>
      <p className="text-muted mt-1 text-xs">Версия: {state.currentVersion.slice(0, 8)}</p>
      {state.lastCheckedAt && (
        <p className="text-muted text-xs">
          Последняя проверка: {new Date(state.lastCheckedAt).toLocaleString("ru-RU")}
        </p>
      )}
      {state.error && (
        <p role="status" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      <Button
        variant="outline"
        className="mt-3"
        disabled={["checking", "downloading", "applying"].includes(state.status)}
        onClick={() => {
          void checkForPwaUpdate(true);
        }}
      >
        Проверить обновление
      </Button>
    </div>
  );
}
