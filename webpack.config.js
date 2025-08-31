const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
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
                        test: /[\\/]node_modules[\\/](react|react-dom|prop-types|scheduler)[\\/]/,
                        name: 'react-common',
                        chunks: 'all',
                        enforce: true,
                    },
                    // Move icons from page bundles to icons.js
                    icons: {
                        test: /[\\/]node_modules[\\/](react-icons|@heroicons)[\\/]/,
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
                },
            }
        },
        // Single entry for SPA shell
        // Other pages are built as lazy load chunks (see src/bundles.js)
        entry: {
            spa: './src/index.js',
        },
        output: {
            path: path.resolve('backend/plant_tracker/static/plant_tracker/'),
            filename: '[name].js',
            clean: {
                keep: /\.(?:png|svg|ico)$/i
            }
        },
        devServer: {
            open: true,
            host: 'localhost',
        },
        plugins: [
            new MiniCssExtractPlugin({ filename: '[name].css' }),
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
                    test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif|mp3)$/i,
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
