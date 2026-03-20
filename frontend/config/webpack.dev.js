const { merge } = require('webpack-merge');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const common = require('./webpack.common');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'eval-source-map',
  output: {
    filename: 'assets/js/[name].js',
    chunkFilename: 'assets/js/[name].chunk.js',
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: [/node_modules/, /__test__/],
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [require.resolve('react-refresh/babel')],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [new ReactRefreshWebpackPlugin()],
  devServer: {
    port: 5173,
    host: '0.0.0.0',
    hot: true,
    historyApiFallback: true,
    allowedHosts: 'all',
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws',
      overlay: { errors: true, warnings: false },
    },
    proxy: [
      {
        context: ['/api'],
        target: process.env.WEBPACK_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: '',
        cookiePathRewrite: '/',
      },
      // Note: /explorer routes are handled by React Router (SPA).
      // Only proxy if the easylife-dashboard runs as a separate MFE.
      // Uncomment below if the dashboard is deployed on port 3001:
      // {
      //   context: (pathname) => pathname.startsWith('/explorer-mfe/'),
      //   target: 'http://localhost:3001',
      //   changeOrigin: true,
      //   secure: false,
      //   pathRewrite: { '^/explorer-mfe': '' },
      // },
    ],
  },
});
