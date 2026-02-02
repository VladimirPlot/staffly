import { registerSW } from "virtual:pwa-register";

export function registerPwa() {
  // registerType: "prompt" — значит update() будет дергать onNeedRefresh
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new Event("pwa:need-refresh"));
    },
    onOfflineReady() {
      // можно оставить пустым или логнуть
      // console.log("App ready to work offline");
    },
  });

  // чтобы PwaUpdatePrompt мог вызвать обновление
  (window as any).__PWA_UPDATE__ = (reload?: boolean) => updateSW(reload);

  return updateSW;
}
