import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0c7a5f", dark: "#07573f", tint: "#e2f3ec" },
        accent: { DEFAULT: "#f2a007", tint: "#fdf0d5", ink: "#7c5200" },
        ink: "#0d2233",
      },
      fontFamily: { sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
