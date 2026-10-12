import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./index.css";
import { applyThemeToDom, getStoredTheme } from "./shared/utils/theme";
import { registerPwa } from "./shared/pwa/registerPwa";

const initialTheme = getStoredTheme() ?? "light";
applyThemeToDom(initialTheme);
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

void registerPwa();
