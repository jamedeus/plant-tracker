/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{html,js,css}"],
    theme: {
        extend: {
            colors: {
                prune: 'var(--prune)',
                repot: 'var(--repot)',
            },
        },
    },
    plugins: [require("daisyui")],
    daisyui: {
        themes: [
            {
                light: {
                    ...require("daisyui/src/theming/themes")["light"],
                    "neutral": "#dddddd",
                    "neutral-content": "#000",
                    "--prune": "theme('colors.orange.300')",
                    "--repot": "#703f21",
                },
                dark: {
                    ...require("daisyui/src/theming/themes")["dark"],
                    "--prune": "theme('colors.orange.300')",
                    "--repot": "#60381b",
                },
            }
        ],
    },
}
