const { merge } = require('webpack-merge');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const dev = require('./webpack.dev');

const rootDir = path.resolve(__dirname, '..');

/**
 * Local development config for VSCode / local backend development.
 *
 * - Copies envConfig/env-local.js → env-config.js so window.__env is populated
 *   with the API_BASE_URL and PREVAIL_API_BASE_URL values from envConfig.
 * - Proxies /api requests to the local backend (WEBPACK_PROXY_TARGET or
 *   http://localhost:8000).
 */
module.exports = merge(dev, {
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(rootDir, 'envConfig/env-local.js'),
          to: 'env-config.js',
          force: true,
        },
      ],
    }),
  ],
});
