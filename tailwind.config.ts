import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Meridian corporate palette — navy + amber "meridian line"
        ink: {
          950: "#070d1c",
          900: "#0b1220",
          850: "#0f1830",
          800: "#131f3d",
          700: "#1c2c52",
        },
        primary: {
          DEFAULT: "#1E40AF",
          600: "#1d4ed8",
          500: "#3B82F6",
          400: "#60a5fa",
        },
        meridian: {
          // the amber/gold "one line everyone agreed on"
          DEFAULT: "#F5A623",
          500: "#f59e0b",
          600: "#d97706",
        },
        aligned: "#10b981",
        drifting: "#f59e0b",
        conflict: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,24,48,0.08), 0 8px 24px rgba(15,24,48,0.06)",
        glow: "0 0 0 1px rgba(59,130,246,0.15), 0 8px 40px rgba(30,64,175,0.18)",
      },
      keyframes: {
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.5)" },
          "70%": { boxShadow: "0 0 0 12px rgba(239,68,68,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0)" },
        },
        meridianSweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2s infinite",
        meridianSweep: "meridianSweep 8s linear infinite",
        floatUp: "floatUp 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
