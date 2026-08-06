import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/pompeiifd/",
  define: {
    // Define environment variables for production build
    'import.meta.env.VITE_PHOTO_LINK': JSON.stringify(process.env.VITE_PHOTO_LINK || 'https://pompeii.gmu.edu/'),
    'import.meta.env.VITE_AUTH_USERNAME': JSON.stringify(process.env.VITE_AUTH_USERNAME || 'admin'),
    'import.meta.env.VITE_AUTH_PASSWORD': JSON.stringify(process.env.VITE_AUTH_PASSWORD || 'pompeii2025'),
  }
});
