import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { router } from "./app/router";
import "./index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        // refetchOnWindowFocus 기본값(true)을 끈다 — 탭 전환만으로 검색 같은
        // 무거운 조회가 조용히 재실행되는 것을 막는다
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    </StrictMode>,
);
