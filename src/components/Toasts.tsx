import { useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";

// 화면 하단에 잠깐 떴다 사라지는 알림. 어디서든 showToast() 한 줄로 띄운다 —
// 화면 이동 없이 알려야 하는 순간(로그인 안내, 입찰 성공 등) 공용
const TOAST_DURATION_MS = 4000;

interface ToastAction {
    label: string;
    // 이동할 경로. 로그인 화면이면 LoginPage가 원래 자리로 되돌려보낸다
    to: string;
}

interface ToastItem {
    id: number;
    message: string;
    action?: ToastAction;
}

let items: readonly ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
    items = items.filter((item) => item.id !== id);
    notify();
}

export function showToast(message: string, action?: ToastAction): void {
    const id = ++seq;
    items = [...items, { id, message, action }];
    notify();
    setTimeout(() => dismiss(id), TOAST_DURATION_MS);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function Toasts() {
    const toasts = useSyncExternalStore(subscribe, () => items);
    const location = useLocation();

    if (toasts.length === 0) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role="status"
                    className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper shadow-lg"
                >
                    <span className="min-w-0">{toast.message}</span>
                    {toast.action && (
                        <Link
                            to={toast.action.to}
                            // 로그인 등을 마치고 지금 보던 자리로 돌아올 수 있게 현재 위치를 실어 보낸다
                            state={{ from: location.pathname + location.search }}
                            onClick={() => dismiss(toast.id)}
                            className="shrink-0 rounded-lg bg-paper/15 px-2.5 py-1 text-[12px] font-bold text-paper hover:bg-paper/25"
                        >
                            {toast.action.label}
                        </Link>
                    )}
                </div>
            ))}
        </div>
    );
}
