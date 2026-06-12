/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#00d992",
        "primary-soft": "#2fd6a1",
        "primary-deep": "#10b981",
        "on-primary": "#101010",
        ink: "#f2f2f2",
        "ink-strong": "#ffffff",
        body: "#bdbdbd",
        mute: "#8b949e",
        hairline: "#3d3a39",
        canvas: "#101010",
        "canvas-soft": "#1a1a1a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "monospace"],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
      },
      letterSpacing: {
        eyebrow: "2.52px",
        wide2: "0.45px",
      },
      fontSize: {
        "display-xl": ["60px", { lineHeight: "60px", letterSpacing: "-0.65px" }],
        "display-lg": ["36px", { lineHeight: "40px", letterSpacing: "-0.9px" }],
        "display-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.6px" }],
        "display-sm": ["20px", { lineHeight: "28px" }],
      },
    },
  },
  plugins: [],
};
