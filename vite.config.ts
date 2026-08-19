import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            // 전부 게이트웨이(8080)로 보낸다. 서비스별 직결은 금물 — 회원 식별이 게이트웨이의
            // 토큰 검증(JwtAuthenticationFilter)이 넣어주는 X-Member-Id 헤더에 의존해서,
            // 서비스로 바로 보내면 그 헤더가 없어 인증 필요한 API가 전부 실패한다
            "/api": "http://localhost:8080", // gateway-service
        },
    },
});
