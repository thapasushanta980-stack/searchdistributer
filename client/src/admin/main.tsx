import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AdminApp } from "./AdminApp";
import { AdminApiError } from "./api";
import "../index.css";

// Client-rendered only: the back office is never server-rendered or indexed.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Don't retry auth/permission failures; one retry for transient ones.
      retry: (count, err) => !(err instanceof AdminApiError && err.status < 500) && count < 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter basename="/admin">
      <AdminApp />
    </BrowserRouter>
  </QueryClientProvider>,
);
