import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FDFCF9",
          50: "#FFFFFF",
          100: "#FDFCF9",
          200: "#F6F3EC",
          300: "#EDE8DC",
        },
        ink: {
          DEFAULT: "#20242E",
          soft: "#3A3F4B",
          muted: "#6B7180",
        },
        lilac: {
          DEFAULT: "#C2A9EF",
          50: "#F4EFFC",
          100: "#E8DEF8",
          200: "#D6C5F3",
          300: "#C2A9EF",
          400: "#A987E4",
          500: "#8E63D6",
          600: "#7548BC",
        },
        gold: {
          DEFAULT: "#D8A63A",
          soft: "#E7C878",
          deep: "#B7822A",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(32, 36, 46, 0.06), 0 12px 40px -12px rgba(32, 36, 46, 0.10)",
        lift: "0 8px 24px -8px rgba(32, 36, 46, 0.12), 0 24px 64px -24px rgba(114, 72, 188, 0.18)",
        glow: "0 0 0 1px rgba(194, 169, 239, 0.25), 0 20px 60px -18px rgba(142, 99, 214, 0.35)",
      },
      maxWidth: {
        content: "72rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 0.8s ease forwards",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
