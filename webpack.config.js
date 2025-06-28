const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require("path");

module.exports = {
    entry: {
        app: "./src/index.js"
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: "index.html",
            template: "src/template.html",
            templateParameters: {
                title: 'Aplicación',
                description: 'Aplicación web creada por Opifex',
            },
            scriptLoading: "blocking"
        }),
        new CopyPlugin({
            patterns: [
              { from: "src/brand", to: "./brand" },
              { from: "src/pages", to: "./pages" }/*,
              { from: "src/media", to: "./media" } */
            ]
        })
    ],
    output: {
        path: path.resolve(__dirname, './build'),
        filename: 'bundle.min.js',
    }
};