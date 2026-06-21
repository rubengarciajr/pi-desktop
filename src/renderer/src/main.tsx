import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Auto-copy: when text is selected, copy to clipboard immediately (like terminal apps).
document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (text && text.length > 0) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
