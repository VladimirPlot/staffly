import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { applyThemeToDom, getStoredTheme } from "./shared/utils/theme";
import { registerPwa } from "./shared/pwa/registerPwa";

const initialTheme = getStoredTheme() ?? "light";
applyThemeToDom(initialTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

void registerPwa();
