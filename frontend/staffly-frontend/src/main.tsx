import { registerSW } from "virtual:pwa-register";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// registerSW возвращает функцию updateSW(reloadPage?: boolean)
const updateSW = registerSW({
  immediate: true,

  onNeedRefresh() {
    // Сообщаем UI: “обновление готово”
    window.dispatchEvent(new CustomEvent("pwa:need-refresh"));
  },

  onOfflineReady() {
    // “Боевой” вариант: ничего не показываем пользователю.
    // (при желании позже можно добавить тихий toast)
  },
});

// Делаем updateSW доступным UI (без сложных контекстов)
(window as any).__PWA_UPDATE__ = updateSW;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
