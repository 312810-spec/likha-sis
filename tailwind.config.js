/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1A2FA0",
          light: "#2E45C7",
          dark: "#101D6B",
        },
        accent: {
          DEFAULT: "#F2A93B",
          light: "#F5C168",
          dark: "#D48C1F",
        },
        leaf: {
          DEFAULT: "#1E5C29",
          light: "#2E7D3A",
          dark: "#123D1A",
        },
      },
    },
  },
  plugins: [],
}