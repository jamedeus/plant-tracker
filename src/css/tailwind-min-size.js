const plugin = require("tailwindcss/plugin");

// Adds min-size-* and max-size-* utility classes with same values as size-*
module.exports = plugin(({ matchUtilities, theme }) => {
    matchUtilities(
        {
            "min-size": v => ({ "min-width": v, "min-height": v }),
            "max-size": v => ({ "max-width": v, "max-height": v }),
        },
        {
            values: theme("width"),
            type: ["length","percentage"],
        }
    );
});
