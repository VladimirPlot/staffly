import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { applyThemeToDom, getStoredTheme } from "./shared/utils/theme";

function runWhenIdle(fn: () => void) {
  const ric = (window as any).requestIdleCallback as
    | undefined
    | ((cb: () => void, opts?: { timeout?: number }) => void);

  if (ric) ric(fn, { timeout: 2000 });
  else window.setTimeout(fn, 800);
}

const initialTheme = getStoredTheme() ?? "light";
applyThemeToDom(initialTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// ✅ Регистрацию PWA откладываем, чтобы не мешать первому экрану
runWhenIdle(() => {
  import("./shared/pwa/registerPwa")
    .then((m) => m.registerPwa())
    .catch(() => {
      // молча
    });
});
