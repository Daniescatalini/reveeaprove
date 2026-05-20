import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#170b43",
        accent: "#b688d6",
        "accent-light": "#f0e4f9",
        "accent-dark": "#8a50b0",
        canvas: "#f2f2f2",
        surface: "#ffffff",
        ink: "#170b43",
        muted: "#8b87a0",
        line: "rgba(23,11,67,0.12)",
        success: "#4CAF85",
        warning: "#E8975A",
        danger: "#E05C5C"
      },
      boxShadow: {
        soft: "0 2px 20px rgba(23,11,67,0.08)",
        lift: "0 10px 34px rgba(23,11,67,0.14)",
        modal: "0 32px 100px rgba(23,11,67,0.28)"
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "Montserrat", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
