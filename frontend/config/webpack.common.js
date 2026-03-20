const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const rootDir = path.resolve(__dirname, '..');

module.exports = {
  entry: path.resolve(rootDir, 'src/index.js'),
  output: {
    path: path.resolve(rootDir, 'build/public'),
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    symlinks: false,
    modules: [path.resolve(rootDir, 'node_modules'), 'node_modules'],
  },
  resolveLoader: {
    symlinks: false,
    modules: [path.resolve(rootDir, 'node_modules'), 'node_modules'],
  },
  module: {
    rules: [
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
      template: path.resolve(rootDir, 'public/index.html'),
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(rootDir, 'public'),
          to: '.',
          globOptions: {
            ignore: ['**/index.html'],
          },
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};
