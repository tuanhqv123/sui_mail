/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#8fc5ff", // Xanh đậm
        secondary: "#cce5ff", // Xanh nhạt
        muted: "#e8f3ff", // Xanh nhạt nhất (dùng cho hover)
        content: "#fafcff", // Màu nền content
      },
    },
  },
  plugins: [],
};
