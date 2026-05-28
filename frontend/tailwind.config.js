/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07111f",
          900: "#0b172a",
          800: "#12233d",
          700: "#1c3356",
        },
        haze: "#d8e4ff",
        mint: "#79f2c0",
        gold: "#f7d96b",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(121, 242, 192, 0.15), 0 25px 80px rgba(2, 8, 23, 0.65)",
      },
      fontFamily: {
        sans: ['"Space Grotesk"', "Trebuchet MS", "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
