import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installElectronApiShim } from "./shell-bridge/electronApiShim";

installElectronApiShim();
document.body.classList.add("tauri-shell");

document.addEventListener(
  "mousedown",
  (event) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest("[data-window-drag-handle]")) return;
    if (
      target.closest(
        [
          "[data-no-window-drag]",
          "button",
          "input",
          "textarea",
          "select",
          "a",
          "[role='button']",
          "[contenteditable='true']",
        ].join(","),
      )
    ) {
      return;
    }
    void window.electronAPI.startWindowDrag?.();
  },
  true,
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
