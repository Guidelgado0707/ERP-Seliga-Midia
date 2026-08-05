/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F6F7F5",
        ink: "#14171A",
        muted: "#5B6460",
        line: "#DDE2DE",
        ledger: {
          DEFAULT: "#0F6B5C",
          soft: "#E4EFEC",
          dark: "#0B4E43",
        },
        amber: {
          DEFAULT: "#B8860B",
          soft: "#F6ECD6",
        },
        crimson: {
          DEFAULT: "#B3261E",
          soft: "#F7E3E1",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
