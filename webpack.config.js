// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');


const isProduction = process.env.NODE_ENV == 'production';

const config = {
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/i,
                loader: 'ts-loader',
                exclude: ['/node_modules/'],
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
        extensions: ['.tsx', '.ts', '.js'],
    },
    externals: {
        recoil: 'recoil',
        lodash: {
            commonjs: 'lodash',
            amd: 'lodash',
            root: '_', // indicates global variable
        },
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
