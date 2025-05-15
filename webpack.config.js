const fs = require('fs');
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
    return {
        mode: argv.mode,
        optimization: {
            minimize: argv.mode === 'production',
            minimizer: [
                // terser & cssnano in parallel
                new TerserPlugin({ extractComments: false, parallel: true }),
                new CssMinimizerPlugin({
                    minimizerOptions: {
                        preset: ['default', { discardComments: { removeAll: true } }],
                    },
                }),
            ],
            splitChunks: {
                cacheGroups: {
                    // Move react + react-dom from page bundles to react-common.js
                    reactCommon: {
                        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                        name: 'react-common',
                        chunks: 'all',
                        enforce: true,
                    },
                    // Move icons from page bundles to icons.js
                    icons: {
                        test: /[\\/]node_modules[\\/](@fortawesome|@heroicons)[\\/]/,
                        name: 'icons',
                        chunks: 'all',
                        enforce: true,
                        minChunks: 2,
                    },
                    // Move headless ui to headlessui.js
                    headlessui: {
                        test: /[\\/]node_modules[\\/]@headlessui[\\/]/,
                        name: 'headlessui',
                        chunks: 'all',
                        enforce: true,
                    },
                    // Move libraries used by all pages to libs.js
                    libs: {
                        test: /[\\/]node_modules[\\/](luxon|clsx)[\\/]/,
                        name: 'libs',
                        chunks: 'all',
                        enforce: true,
                    },
                    // Extract CSS shared by 2 or more pages to separate shared.css
                    sharedStyles: {
                        type: 'css/mini-extract',
                        name: 'shared',
                        chunks: 'all',
                        enforce: true,
                        minChunks: 2,
                        reuseExistingChunk: true,
                    }
                },
            }
        },
        // Add entry for each directory in src/pages
        entry: fs.readdirSync(path.resolve('src/pages')).reduce((o, page) => (
            { ...o, [page]: `./src/pages/${page}/index.js`}
        ), {}),
        output: {
            path: path.resolve('backend/plant_tracker/static/plant_tracker/'),
            filename: '[name].js',
            clean: true
        },
        devServer: {
            open: true,
            host: 'localhost',
        },
        plugins: [
            new MiniCssExtractPlugin({ filename: '[name].css' }),
            // Save manifest.json (maps page names to list of bundle dependencies)
            new WebpackManifestPlugin({
                generate(_, __, entrypoints) { return entrypoints; },
            }),
            ...(env.analyze ? [new BundleAnalyzerPlugin()] : []),
        ],
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/i,
                    loader: 'babel-loader',
                },
                {
                    test: /\.css$/i,
                    use: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        'postcss-loader'
                    ],
                },
                {
                    test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                    type: 'asset',
                },

                // Add your rules for custom modules here
                // Learn more about loaders from https://webpack.js.org/loaders/
            ],
        },
        resolve: {
            alias: {
                src: path.resolve('src'),
            }
        },
    };
};
