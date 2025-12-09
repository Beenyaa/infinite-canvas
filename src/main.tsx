import * as React from "react";
import { createRoot } from "react-dom/client";
import "~/src/index.css";
import { App } from "~/src/app";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
