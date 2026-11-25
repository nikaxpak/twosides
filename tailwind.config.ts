import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#d3d6da",
        ink: "#000000",
        muted: "#4e5157",
        faint: "#7a7e85",
        rule: "rgba(0, 0, 0, 0.2)",
        lime: "#c6f432",
        cred: {
          high: "#2f7d3c",
          mid: "#c9930a",
          low: "#c23a2b",
          none: "#8a8e95",
        },
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', "Helvetica Neue", "Arial", "sans-serif"],
        pixel: ['"Pixelify Sans"', "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
