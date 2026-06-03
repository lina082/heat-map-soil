import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#16a34a",
          light: "#22c55e",
          dark: "#15803d",
        },
        // dark mode surfaces (default — dark-first design)
        surface: {
          DEFAULT: "#111111",
          raised: "#1a1a1a",
          overlay: "#222222",
          border: "#2a2a2a",
          subtle: "#333333",
        },
        ink: {
          DEFAULT: "#e5e5e5",
          muted: "#a3a3a3",
          faint: "#525252",
        },
      },
      fontFamily: {
        sans: ["Rubik", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
