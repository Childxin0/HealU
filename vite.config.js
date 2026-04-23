import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import Uni from '@uni-helper/plugin-uni'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget = env.VITE_HEALU_SERVER_URL || 'http://localhost:3000'

  return {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    plugins: [
      // https://uni-helper.js.org/plugin-uni
      Uni(),
    ],
    server: {
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})


