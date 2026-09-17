import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

let external = [
  '@point-of-sale/receipt-printer-encoder', '@point-of-sale/webusb-receipt-printer', 
  '@point-of-sale/webserial-receipt-printer', '@point-of-sale/webbluetooth-receipt-printer'
]

export default defineConfig({
  base: "./",

  plugins: [
    svelte()
  ],

  server: {
    fs: {
      allow: ['..'],
    },
  },

  optimizeDeps: {
    exclude: external
  },

  build: {
    rollupOptions: {
      /* The two pages of this project, which share everything they can: the
         chunks they have in common land under `dist/assets` and a pane fixed
         for one page is fixed for the other */

      input: {
        main: 'index.html',
        inspector: 'inspector.html',
      },

      external
    }
  }
})
