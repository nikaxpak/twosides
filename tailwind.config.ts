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
        paper: "#fffff9",
        ink: "#020201",
        muted: "#55554f",
        faint: "#6a6a63",
        rule: "rgba(2, 2, 1, 0.25)",
        sticker: "#f0453c",
        sheet: {
          yellow: "#f6f09e",
          blue: "#b9d6f7",
          pink: "#f7b6c9",
          green: "#3ea35c",
        },
        cred: {
          high: "#2f9e4f",
          mid: "#f2b705",
          low: "#e5443a",
          none: "#b9b9b2",
        },
      },
      fontFamily: {
        serif: ['"Newsreader"', "Georgia", "serif"],
        sans: ['"Schibsted Grotesk"', "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
