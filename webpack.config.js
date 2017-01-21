/* global __dirname */

var isProd              = String(process.env.NODE_ENV).trim()  === "production";
var isProdDebug         = String(process.env.PROD_MODE).trim()  === "production_debug";

var fs                  = require("fs");
var path                = require('path');
var webpack             = require('webpack');
var CopyWebpackPlugin   = require('copy-webpack-plugin');
//var WrapperPlugin       = require('wrapper-webpack-plugin');
var packageJson         = require("./package.json");

var _appSource      = path.resolve(__dirname, 'src');
var _appDev         = path.resolve(__dirname, 'dev');
var _appBuild       = path.resolve(__dirname, '_BUILD');

var _srcFilename    = 'StickOnScroll.js';
var _jsSrcPath      = path.join(_appSource, _srcFilename);


var config = {
    entry: _jsSrcPath,
    output: {
        path:           _appBuild,
        filename:       'StickOnScroll.js',
        library:        "StickOnScroll",
        libraryTarget:  "umd",
        umdNamedDefine: true
    },
    devServer: {
        contentBase: _appBuild
    },
    debug: {
        "lessLoader": true,
        "babelLoader": true
    },
    module: {
        preLoaders: [
            //{
            //    test:       /\.js$/,
            //    loaders:    ['eslint-loader'],
            //    include: [
            //        /src2/
            //    ]
            //}
        ],
        loaders: [
            {
                test:       /\.js$/,
                // exclude:    /node_modules/,
                include:    [
                    /src/,
                    /common-micro-libs[\/\\]src/,
                    /dev/
                ],
                loader: 'babel',
                query: {
                    presets: [
                        "es2015",
                        "stage-0"
                    ],
                    plugins: [
                        "add-module-exports"
                    ]
                }
            },
            {
                test: /\.less$/,
                loader: "style-loader!css-loader!less-loader"
            },
            {
                test: /\.css$/,
                loader: "style-loader!css-loader"
            },
            {
                test: /\.html$/,
                loader: "raw"
            },
            {
                test: /\.(eot|ttf|svg|woff|png|gif)(\?.*)?$/,
                loader: 'url?limit=150000'
            }
        ]
    },
    resolve: {
        extensions: ["", ".webpack.js", ".web.js", ".js"]
    },
    plugins: [
        // Simply copies the files over
        new CopyWebpackPlugin(
            [
                { from: _appSource }
            ],
            {
                ignore: [
                    { glob: '**/*', dot: true }
                ]
            }
        ),

        // For DEV only
        new CopyWebpackPlugin(
            [
                { from: path.resolve(_appDev)}
            ]
        ),
        // Avoid publishing files when compilation fails
        new webpack.NoErrorsPlugin()
    ],
    stats: {
        colors: true
    },
    devtool: 'source-map',
    eslint: {
        fix: false
    }
};


//-------------------------
// Production build
//-------------------------
if (!isProdDebug && (isProd || process.argv.some(function(arg){ return arg === "-p"}))) {
    console.log("Running PRODUCTION build...");

    config.plugins.unshift(
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify("production")
            }
        })
    );

    config.plugins.push(
        new webpack.optimize.OccurenceOrderPlugin(),
        new webpack.optimize.DedupePlugin(),
        //new WrapperPlugin({
        //    header: fs.readFileSync("node_modules/build-helpers/general/js-private-scope-wrapper-open.js", "utf8"),
        //    footer: fs.readFileSync("node_modules/build-helpers/general/js-private-scope-wrapper-close.js", "utf8")
        //}),
        new webpack.optimize.UglifyJsPlugin({
            comments: false,
            compress: {
                warnings: false
            }
        })
    );

    config.devtool = 'source-map';
}


module.exports = config;
