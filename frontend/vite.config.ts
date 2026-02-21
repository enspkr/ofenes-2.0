import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        proxy: {
            // Forward REST API calls to the Go backend
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            // Forward WebSocket connections to the Go backend
            '/ws': {
                target: 'ws://localhost:8080',
                ws: true,
            },
        },
    },
})
