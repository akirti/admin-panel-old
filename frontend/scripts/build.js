'use strict';

const path = require('path');
const { execSync } = require('child_process');

execSync('webpack --mode production', {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});
