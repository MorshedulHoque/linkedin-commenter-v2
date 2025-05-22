/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./popup.html", // Include the popup.html file
    "./scripts/**/*.js", // Include all JavaScript files in the scripts folder
  ],
  theme: {
    extend: {
      colors: {
        customDark: '#0c0c0c',
        customBlue: '#001435',
      },
    },
  },
  plugins: [],
};
