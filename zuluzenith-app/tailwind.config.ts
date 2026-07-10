// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        "space-grotesk": ["var(--font-space-grotesk)", "sans-serif"],
      },
      colors: {
        background: "#FAF8F5",
        foreground: "#101014",
        primary: {
          DEFAULT: "#A1223B",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F1EEE8",
          foreground: "#8A8A93",
        },
        destructive: "#C43D3D",
      },
    },
  },
  plugins: [],
};
export default config;
