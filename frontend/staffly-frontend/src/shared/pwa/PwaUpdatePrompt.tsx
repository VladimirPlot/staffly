import React from "react";
import Button from "../ui/Button";
import { applyPwaUpdate, getUpdateState, subscribeUpdate } from "./registerPwa";

export default function PwaUpdatePrompt() {
  const state = React.useSyncExternalStore(subscribeUpdate, getUpdateState);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const preventCancel = (event: Event) => event.preventDefault();
    const keepOpen = () => {
      if (state.ready && !dialog.open) dialog.showModal();
    };
    dialog.setAttribute("closedby", "none");
    dialog.addEventListener("cancel", preventCancel);
    dialog.addEventListener("close", keepOpen);
    if (state.ready && !dialog.open) dialog.showModal();
    else if (!state.ready && dialog.open) dialog.close();
    return () => {
      dialog.removeEventListener("cancel", preventCancel);
      dialog.removeEventListener("close", keepOpen);
    };
  }, [state.ready]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => event.preventDefault()}
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-description"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-6 text-[var(--staffly-text)] shadow-xl backdrop:bg-black/50"
    >
      <h2 id="pwa-update-title" className="text-lg font-semibold">
        Доступна новая версия Staffly
      </h2>
      <p id="pwa-update-description" className="mt-2 text-sm">
        Обновите приложение, чтобы продолжить работу. Перед перезагрузкой сохраним график на этом устройстве.
      </p>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      )}
      <Button
        className="mt-5 w-full"
        isLoading={state.status === "applying"}
        onClick={() => {
          void applyPwaUpdate();
        }}
      >
        {state.status === "applying" ? "Обновляем…" : "ОБНОВИТЬ"}
      </Button>
    </dialog>
  );
}
