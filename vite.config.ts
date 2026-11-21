import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // ⚠️ `strictPort`: port band bo'lsa Vite JIMGINA boshqasiga o'tadi
    // (5174) va o'sha manzil backend'dagi CORS ro'yxatida YO'Q — har
    // so'rov brauzerda bloklanadi, server jurnalida esa hech narsa
    // ko'rinmaydi. Yiqilgani yaxshi: sabab darhol ma'lum bo'ladi.
    strictPort: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        /*
         * ⚠️ Xarita va grafik kutubxonalari ALOHIDA bo'lakda. Leaflet
         * va Recharts birgalikda ~400 KB: ular asosiy bo'lakda qolsa,
         * login sahifasi ham o'sha hajmni yuklab o'tirardi.
         */
        manualChunks: {
          /*
           * ⚠️ Xarita va grafik kutubxonalari ALOHIDA bo'lakda.
           * Leaflet va Recharts birgalikda ~550 KB: ular asosiy
           * bo'lakda qolsa, LOGIN sahifasi ham o'sha hajmni yuklab
           * o'tirardi — tizimga kirmagan odam xarita kutubxonasini
           * kutardi.
           */
          map: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
          /*
           * ⚠️ `react-vendor` ALOHIDA va bu KESH uchun: React va
           * router deyarli hech qachon o'zgarmaydi, ilova kodi esa
           * har deploy'da o'zgaradi. Bitta bo'lakda bo'lsa,
           * foydalanuvchi har yangilanishda 500 KB ni qaytadan
           * yuklab olardi.
           */
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': [
            '@tanstack/react-query',
            'axios',
            'socket.io-client',
            'zustand',
          ],
          /*
           * ⚠️ Animatsiya dvigateli ham ALOHIDA: u har sahifada (segment
           * boshqaruvi, raqam sanog'i) kerak, lekin deyarli o'zgarmaydi —
           * ilova kodi bilan bitta bo'lakda bo'lsa, har deploy'da qayta
           * yuklanardi.
           */
          'motion-vendor': ['motion', 'motion/react'],
        },
      },
    },
  },
});
