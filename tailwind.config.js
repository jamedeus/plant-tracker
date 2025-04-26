/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin')

module.exports = {
    content: ["./src/**/*.{html,js,css}"],
    theme: {
        extend: {
            colors: {
                prune: 'var(--prune)',
                repot: 'var(--repot)',
            }
        },
    },
    plugins: [
        require("daisyui"),
        plugin(function({ matchUtilities, theme }) {
            // Add min-size classes (min-w + min-h)
            matchUtilities(
                {
                    'min-size': value => ({
                        'min-width': value,
                        'min-height': value,
                    }),
                },
                {
                    // Use same values as w- classes
                    values: theme('width'),
                    // Enable arbitrary values
                    type: ['length', 'percentage'],
                }
            )
            // Add max-size classes (max-w + max-h)
            matchUtilities(
                {
                    'max-size': value => ({
                        'max-width': value,
                        'max-height': value,
                    }),
                },
                {
                    // Use same values as w- classes
                    values: theme('width'),
                    // Enable arbitrary values
                    type: ['length', 'percentage'],
                }
            )
        }),
    ],
    daisyui: {
        themes: [
            {
                light: {
                    ...require("daisyui/src/theming/themes")["light"],
                    "base-100": "#F2F2F2",
                    "base-200": "#E5E6E6",
                    "base-300": "#dddddd",
                    "neutral": "#FFFFFF",
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
