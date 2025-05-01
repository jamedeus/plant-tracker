// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isProduction = process.env.NODE_ENV == 'production';


const config = {
    optimization: {
        minimize: isProduction,
        splitChunks: {
            cacheGroups: {
                // Move react + react-dom from page bundles to react-common.js
                reactCommon: {
                    test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                    name: 'react-common',
                    chunks: 'all',
                    enforce: true,
                },
            },
        },
    },
    entry: {
        login: './src/pages/login/index.js',
        user_profile: './src/pages/user_profile/index.js',
        overview: './src/pages/overview/index.js',
        register: './src/pages/register/index.js',
        manage_plant: './src/pages/manage_plant/index.js',
        manage_group: './src/pages/manage_group/index.js',
        permission_denied: './src/pages/permission_denied/index.js',
        confirm_new_qr_code: './src/pages/confirm_new_qr_code/index.js',
    },
    output: {
        path: path.resolve(__dirname, 'backend/plant_tracker/static/plant_tracker/'),
        filename: '[name].js'
    },
    devServer: {
        open: true,
        host: 'localhost',
    },
    plugins: [
        ...(isProduction ? [ new MiniCssExtractPlugin({ filename: '[name].css' }) ] : [])
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
                    isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
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
            src: path.resolve(__dirname, 'src'),
        }
    },
};

module.exports = () => {
    if (isProduction) {
        config.mode = 'production';
    } else {
        config.mode = 'development';
    }
    return config;
};
