import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] }, plugins: [react(), tailwindcss()], base: './', server: { port: 5177, strictPort: true } });
