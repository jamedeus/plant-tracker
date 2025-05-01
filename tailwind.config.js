/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
    content: ["./src/**/*.{html,js}"],
    theme: {
        extend: {
            colors: {
                prune: 'oklch(var(--prune) / <alpha-value>)',
                repot: 'oklch(var(--repot) / <alpha-value>)',
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
            );
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
            );
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
                    "--prune": "0.83 0.155 66.29",
                    "--repot": "0.42 0.081 50.5",
                },
                dark: {
                    ...require("daisyui/src/theming/themes")["dark"],
                    "--prune": "0.85 0.1265 66.29",
                    "--repot": "0.38 0.0709 54.66",
                },
            }
        ],
    },
};
