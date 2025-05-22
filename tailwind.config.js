/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                'space-mono': ['"Space Mono"', 'monospace'],
            },
            colors: {
                'cyber-black': '#0a0a0a',
                'cyber-gray': '#1a1a1a',
                'cyber-blue': '#ffffff',
                'cyber-purple': '#9d00ff',
                'cyber-pink': '#ff00f7',
            },
        },
    },
    plugins: [],
};
  