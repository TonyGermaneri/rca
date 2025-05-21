import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    base: "/rca/",
    server: {
        fs: {
            // Allow serving files from one level up to the project root
            allow: ['..', '../..'],
        },
    },
    plugins: [vue()],
})
