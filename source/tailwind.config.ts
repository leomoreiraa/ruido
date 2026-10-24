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
        ink: {
          DEFAULT: "#171512",
          pure: "#0d0c0b",
          light: "#292520",
        },
        paper: {
          DEFAULT: "#eee4d1",
          dark: "#e0d4be",
          light: "#f7efdf",
          card: "#f0e6d4",
        },
        punk: {
          red: "#ac2c24",
          "red-dark": "#842620",
          acid: "#d3ff20",
          "acid-hover": "#bfe71b",
          cyan: "#81918a",
          grey: "#797269",
          orange: "#bc8251",
        },
      },
      fontFamily: {
        heavy: ["Anton", "Impact", "sans-serif"],
        black: ["'Archivo Black'", "'Arial Black'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "Courier New", "monospace"],
        marker: ["'Permanent Marker'", "cursive"],
        gothic: ["UnifrakturMaguntia", "cursive"],
      },
      boxShadow: {
        punk: "6px 6px 0 #171512",
        "punk-lg": "10px 10px 0 #171512",
        "punk-red": "6px 6px 0 #ac2c24",
        "punk-acid": "6px 6px 0 #d3ff20",
        "punk-double": "6px 6px 0 #171512, 8px 8px 0 #ac2c24",
      },
    },
  },
  plugins: [],
};

export default config;
