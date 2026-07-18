import type { Config } from "tailwindcss";
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: { extend: { colors: { night: "#0f2742", electric: "#2563eb" } } },
  plugins: [],
} satisfies Config;
