import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App.tsx";
import { useTheme } from "./theme";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60_000 },
  },
});

function Root() {
  const { theme, toggle } = useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <App theme={theme} onToggleTheme={toggle} />
      <Toaster theme={theme} richColors position="top-right" />
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
