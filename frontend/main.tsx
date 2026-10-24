import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import AppProviders from "@/app/layout";
import AppRouter from "@/app/router";
import { baseURL } from "@/lib/runtime";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter basename={baseURL || "/"}>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
    <Toaster theme="dark" position="bottom-right" />
  </StrictMode>,
);
