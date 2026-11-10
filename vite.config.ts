import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages project-site base path.
export default defineConfig({
  base: '/kehelovitigama-hardware/',
  plugins: [react()],
})
