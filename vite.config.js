import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // または vue など

export default defineConfig({
    plugins: [react()],
    // リポジトリ名をスラッシュで挟んで指定
    base: '/Miku_Fever/',
})