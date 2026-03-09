'use strict';

const path = require('path');
const { execSync } = require('child_process');

execSync('webpack --config config/webpack.prod.js', {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});
