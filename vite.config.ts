import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['tests/unit/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'] },
} as any)
