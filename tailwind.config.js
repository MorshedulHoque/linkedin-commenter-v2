/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.html", // Include all HTML files in the templates directory
    "./static/**/*.css", // Include all CSS files in the static directory
    "./static/**/*.js", // Include all JS files in the static directory
  ],
  theme: {
    screens: {
      sm: "640px", // Small devices (phones)
      md: "768px", // Medium devices (tablets)
      lg: "1024px", // Large devices (desktops)
      xl: "1280px", // Extra large devices (larger desktops)
      "2xl": "1536px", // 2X larger devices (large monitors)
    },
    extend: {},
  },
  plugins: [require("daisyui")], // DaisyUI for additional components
};
