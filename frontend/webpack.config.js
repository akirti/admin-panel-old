const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: path.resolve(__dirname, 'src/main.jsx'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev ? 'assets/js/[name].js' : 'assets/js/[name].[contenthash:8].js',
    chunkFilename: isDev ? 'assets/js/[name].chunk.js' : 'assets/js/[name].[contenthash:8].chunk.js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    symlinks: false,
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
  },
  resolveLoader: {
    symlinks: false,
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: isDev ? [require.resolve('react-refresh/babel')] : [],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico|webp)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name].[hash:8][ext]',
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name].[hash:8][ext]',
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
    }),
    ...(isDev
      ? [new ReactRefreshWebpackPlugin()]
      : [
          new MiniCssExtractPlugin({
            filename: 'assets/css/[name].[contenthash:8].css',
            chunkFilename: 'assets/css/[name].[contenthash:8].chunk.css',
          }),
        ]),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'public'),
          to: '.',
          globOptions: {
            ignore: ['**/index.html'],
          },
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  optimization: {
    minimizer: ['...', new CssMinimizerPlugin()],
    splitChunks: {
      chunks: 'all',
    },
  },
  devServer: {
    port: 5173,
    host: '0.0.0.0',
    hot: true,
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api'],
        target: process.env.WEBPACK_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: '',
        cookiePathRewrite: '/',
      },
      {
        context: ['/explorer'],
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        pathRewrite: { '^/explorer': '' },
      },
    ],
  },
  devtool: isDev ? 'eval-source-map' : 'source-map',
};
