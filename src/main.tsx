import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import { applyAccentToDocument, getSavedAccent } from "@/utils/theme";

// Initialize saved theme accent
applyAccentToDocument(getSavedAccent());

// Request 6: Completely remove browser context menu across the entire app
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
}, false);

// Request 7: Disable inspect element and developer tools shortcuts in production
if (!import.meta.env.DEV) {
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
      ((e.ctrlKey || e.metaKey) && ["u", "U"].includes(e.key))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider>
      <App />
      <Toaster />
    </Provider>
  </React.StrictMode>,
);
