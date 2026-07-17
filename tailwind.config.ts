import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: "#EEF6FB",
        chrome: "#DCECF6",
        cream: "#FDFCF9",
        page: "#FDFCF9",
        ink: "#2D2926",
        muted: "#7E776F",
        terracotta: "#B56A3A",
        border: "#DDD5CA",
        sage: "#6E8B6A",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
