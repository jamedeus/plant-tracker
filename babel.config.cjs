module.exports = {
    plugins: ["@babel/syntax-dynamic-import"],
    presets: [
        ["@babel/preset-env",
            { targets:{ chrome:"111", firefox:"128", safari:"16.4" } }
        ],
        ["@babel/preset-react", { runtime:"automatic" }]
    ],
    // Fix yet-another-react-lightbox tests (ESM-only)
    env: {
        test: {
            presets: [
                ["@babel/preset-env",
                    { targets:{ node:"current" }, modules:"commonjs" }
                ]
            ]
        }
    }
};
