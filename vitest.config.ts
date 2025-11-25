/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node", // Changed from jsdom to node for service testing
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
