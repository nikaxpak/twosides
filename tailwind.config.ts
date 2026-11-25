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
        ink: "#000000",
        light: "#f1f1f1",
        // Per-half colours, set by .side-dark / .side-light in globals.css
        fg: "var(--fg)",
        body: "var(--body)",
        side: "var(--side)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        rule: "var(--rule)",
        cred: {
          high: "#3aa84b",
          mid: "#e0a910",
          low: "#e2493a",
          none: "#8f8f8f",
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', "Georgia", "serif"],
        display: ['"Barlow Condensed"', "Arial Narrow", "sans-serif"],
        fell: ['"IM Fell English"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
