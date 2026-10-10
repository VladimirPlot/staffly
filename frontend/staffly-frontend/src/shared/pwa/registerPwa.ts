import { prepareForReload } from "./reloadSafety";
import { canOfferUpdate, type UpdateState } from "./updateState";

const CHECK_INTERVAL = 5 * 60 * 1000;
const MIN_CHECK_INTERVAL = 30_000;
const state: UpdateState = {
  status: "idle",
  ready: false,
  currentVersion: __APP_BUILD_ID__,
  availableVersion: null,
  lastCheckedAt: null,
  error: null,
};
const listeners = new Set<() => void>();
let snapshot = { ...state };
let registration: ServiceWorkerRegistration | undefined;
let started = false;
let checking: Promise<void> | null = null;
let applying: Promise<void> | null = null;
let controllerChanged = false;
let lastAttempt = 0;

function publish(change: Partial<UpdateState>) {
  Object.assign(state, change);
  snapshot = { ...state };
  listeners.forEach((listener) => listener());
}

export const getUpdateState = () => snapshot;
export function subscribeUpdate(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function detectWaiting() {
  if (registration && canOfferUpdate(registration, controllerChanged)) {
    publish({ status: "ready", ready: true, error: null });
  }
}

export async function checkForPwaUpdate(force = false): Promise<void> {
  if (checking) return checking;
  if (!navigator.onLine || applying || (!force && Date.now() - lastAttempt < MIN_CHECK_INTERVAL)) return;
  lastAttempt = Date.now();
  checking = (async () => {
    if (!state.ready) publish({ status: "checking", error: null });
    try {
      let versionError: unknown = null;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Version check: ${response.status}`);
        const version = (await response.json()) as { buildId?: string };
        if (!version.buildId) throw new Error("Missing build ID");
        publish({ availableVersion: version.buildId, lastCheckedAt: Date.now() });
      } catch (error) {
        versionError = error;
      }
      if (!registration && "serviceWorker" in navigator) await registerWorker();
      if (registration) {
        await registration.update();
        detectWaiting();
      } else if (
        !("serviceWorker" in navigator) &&
        state.availableVersion &&
        state.availableVersion !== state.currentVersion
      ) {
        publish({ status: "ready", ready: true });
      }
      if (!state.ready && (versionError || ("serviceWorker" in navigator && !registration)))
        throw versionError ?? new Error("Registration failed");
      if (!state.ready && state.status !== "downloading") publish({ status: "idle" });
    } catch (error) {
      console.warn("PWA update check failed", error);
      publish({
        status: state.ready ? "ready" : "error",
        error: "Не удалось проверить обновление. Повторим при восстановлении соединения.",
      });
    }
  })().finally(() => {
    checking = null;
  });
  return checking;
}

export async function applyPwaUpdate(): Promise<void> {
  if (applying) return applying;
  if (!state.ready) return;
  applying = (async () => {
    publish({ status: "applying", error: null });
    try {
      await prepareForReload();
      if (controllerChanged || !("serviceWorker" in navigator)) {
        window.location.reload();
        return;
      }
      const waiting = registration?.waiting;
      if (!waiting) throw new Error("No waiting service worker");
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          navigator.serviceWorker.removeEventListener("controllerchange", changed);
          reject(new Error("Activation timed out"));
        }, 15_000);
        function changed() {
          window.clearTimeout(timer);
          navigator.serviceWorker.removeEventListener("controllerchange", changed);
          resolve();
        }
        navigator.serviceWorker.addEventListener("controllerchange", changed);
        waiting.postMessage({ type: "SKIP_WAITING" });
      });
      window.location.reload();
    } catch (error) {
      console.warn("PWA activation failed", error);
      publish({
        status: "error",
        error: "Не удалось завершить обновление. Данные остаются на этой странице. Нажмите «ОБНОВИТЬ» ещё раз.",
      });
    }
  })().finally(() => {
    applying = null;
  });
  return applying;
}

export async function registerPwa(): Promise<void> {
  if (started || import.meta.env.DEV) return;
  started = true;
  if ("serviceWorker" in navigator) {
    let previousController = navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (previousController) {
        controllerChanged = true;
        if (!applying) publish({ status: "ready", ready: true, error: null });
      }
      previousController = navigator.serviceWorker.controller;
    });
    await registerWorker();
  }
  const check = () => {
    void checkForPwaUpdate();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.addEventListener("online", () => {
    void checkForPwaUpdate(true);
  });
  window.addEventListener("focus", check);
  window.setInterval(() => {
    if (document.visibilityState === "visible") check();
  }, CHECK_INTERVAL);
  await checkForPwaUpdate(true);
}

async function registerWorker(): Promise<void> {
  try {
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    });
    const watchInstalling = () => {
      const worker = registration?.installing;
      if (!worker) return;
      if (registration?.active) publish({ status: "downloading" });
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") queueMicrotask(detectWaiting);
        if (worker.state === "redundant" && !state.ready) {
          publish({ status: "error", error: "Загрузка обновления прервалась. Повторим проверку автоматически." });
        }
      });
    };
    registration.addEventListener("updatefound", watchInstalling);
    watchInstalling();
    detectWaiting();
  } catch (error) {
    console.warn("PWA registration failed", error);
    publish({ status: "error", error: "Браузер не смог подключить обновления приложения." });
  }
}
