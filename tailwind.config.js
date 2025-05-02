/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
    content: ["./src/**/*.{html,js}"],
    theme: {
        extend: {
            colors: {
                prune: 'oklch(var(--color-prune) / <alpha-value>)',
                repot: 'oklch(var(--color-repot) / <alpha-value>)',
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
};
